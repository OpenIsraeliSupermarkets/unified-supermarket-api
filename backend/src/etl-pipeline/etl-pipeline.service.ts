import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataAccessService, SupermarketChain } from './data-access.service.js';
import { TransformerFactory } from './transformers/transformer-factory.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Chain, Store, Item } from '@prisma/client';
import { from, mergeMap, toArray } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { getSupportedChains } from './data-access.service.js';
import { UniformItem, UniformStore } from './schemas/uniform/index.js';

@Injectable()
export class EtlPipelineService {
    private readonly logger = new Logger(EtlPipelineService.name);
    private readonly CONCURRENCY_LIMIT = 1;

    constructor(
        private readonly dataAccess: DataAccessService,
        private readonly transformerFactory: TransformerFactory,
        private readonly prisma: PrismaService,
    ) { }

    async determineChainsToProcess(): Promise<SupermarketChain[]> {
        try {
            const availableChains = await this.dataAccess.listAvailableChains();
            this.logger.log(`Available chains: ${availableChains}`);
            const supportedChains = getSupportedChains();
            this.logger.log(`Supported chains: ${supportedChains}`);

            // Filter and cast valid chains to SupermarketChain enum
            // TODO: determine this is the correct way to do this
            return availableChains
                .filter(chain => supportedChains.includes(chain as SupermarketChain))
                .map(chain => chain as SupermarketChain);
        } catch (error) {
            this.logger.error(`Failed to determine chains to process: ${error.message}`);
            return [];
        }
    }

    // Run every 30 seconds for demo/testing purposes
    @Cron(CronExpression.EVERY_12_HOURS)
    async runEtlPipelineJob() {
        this.logger.log('========================================================');
        this.logger.log('STARTING ETL PIPELINE EXECUTION');
        this.logger.log('========================================================');

        try {
            const chainsToProcess = await this.determineChainsToProcess();
            this.logger.log(`Found ${chainsToProcess.length} supported chains to process`);

            // if no chains to process, return
            if (chainsToProcess.length === 0) {
                this.logger.error('No chains to process: no supported chains found');
                throw new Error('No chains to process: no supported chains found - something is wrong');
            }

            for (const chain of chainsToProcess) {
                // Process stores
                const storeList = await this.dataAccess.extractStoreData(chain);
                const storeTransformer = this.transformerFactory.getTransformer(chain);
                const transformedStoreList = storeTransformer.transformStoreData(storeList);
                this.logger.log(`Processing ${transformedStoreList.length} stores for chain ${chain}`);
                await this.upsertStoresPipeline(chain, transformedStoreList);

                // Process products
                const productList = await this.dataAccess.extractProductData(chain);
                const productTransformer = this.transformerFactory.getTransformer(chain);
                const transformedProductList = productTransformer.transformProductData(productList);
                this.logger.log(`Processing ${transformedProductList.length} products for chain ${chain}`);
                await this.upsertProductsPipeline(chain, transformedProductList);
            }

        } catch (error) {
            this.logger.error(`ETL PIPELINE FAILED: ${error.message}`);
            throw error;
        }
    }

    async upsertStoresPipeline(chain: string, stores: UniformStore[]): Promise<void> {
        try {
            const chainObject = await this.upsertChain(chain);
            await this.processStoresBatch(chainObject, stores);
        } catch (error) {
            this.logger.error(`Error in upsertStoresPipeline for chain ${chain}:`, error);
            throw error;
        }
    }

    async upsertProductsPipeline(chain: string, products: UniformItem[]): Promise<void> {
        try {
            const chainObject = await this.upsertChain(chain);
            await this.processProductsBatch(chainObject, products);
        } catch (error) {
            this.logger.error(`Error in upsertProductsPipeline for chain ${chain}:`, error);
            throw error;
        }
    }

    private async upsertChain(chain: string): Promise<Chain> {
        return this.prisma.chain.upsert({
            where: { name: chain },
            update: {},
            create: {
                name: chain,
                chainId: chain
            }
        });
    }

    private async upsertStore(chainObject: Chain, store: UniformStore) {
        return this.prisma.store.upsert({
            where: {
                chainId_storeId: {
                    chainId: chainObject.name,
                    storeId: store.storeId
                }
            },
            update: {
                name: store.name,
                address: store.address,
                city: store.city,
                zipCode: store.zipCode
            },
            create: {
                storeId: store.storeId,
                name: store.name,
                address: store.address,
                city: store.city,
                zipCode: store.zipCode,
                chainId: chainObject.name,
                chainObjectId: chainObject.id
            }
        });
    }

    private async upsertItem(product: UniformItem): Promise<Item> {
        return this.prisma.item.upsert({
            where: { itemCode: product.itemCode },
            update: {
                name: product.itemName,
                unit: product.itemUnitOfMeasure,
                category: product.itemStatus,
                brand: product.manufacturerName
            },
            create: {
                itemCode: product.itemCode,
                name: product.itemName,
                unit: product.itemUnitOfMeasure,
                category: product.itemStatus,
                brand: product.manufacturerName
            }
        });
    }

    private async upsertPrice(item: Item, chainObject: Chain, storeObject: Store, product: UniformItem) {
        return this.prisma.itemPrice.upsert({
            where: {
                unique_price_entry: {
                    chainId: chainObject.name,
                    storeId: product.storeId,
                    itemId: item.id,
                    timestamp: new Date(Date.now())
                }
            },
            update: {
                price: product.itemPrice,
                currency: "ILS",
            },
            create: {
                itemId: item.id,
                itemCode: product.itemCode,
                price: product.itemPrice,
                currency: "ILS",
                storeId: product.storeId,
                storeObjectId: storeObject.id,
                chainObjectId: chainObject.id,
                chainId: chainObject.name,
                timestamp: new Date(Date.now())
            }
        });
    }

    private async processStoresBatch(chainObject: Chain, stores: UniformStore[]) {
        return firstValueFrom(
            from(stores).pipe(
                mergeMap(
                    async (store) => this.upsertStore(chainObject, store),
                    this.CONCURRENCY_LIMIT
                ),
                toArray()
            )
        );
    }

    private async processProductsBatch(chainObject: Chain, products: UniformItem[]) {
        return firstValueFrom(
            from(products).pipe(
                mergeMap(
                    async (product) => {
                        try {
                            const item = await this.upsertItem(product);

                            const storeObject = await this.prisma.store.findUnique({
                                where: {
                                    chainId_storeId: {
                                        chainId: chainObject.name,
                                        storeId: product.storeId,
                                    }
                                }
                            });

                            if (!storeObject) {
                                throw new Error(`Store ${product.storeId} not found in chain ${chainObject.name}`);
                            }

                            // Price is critical as it depends on all above
                            await this.upsertPrice(item, chainObject, storeObject, product);
                        } catch (error) {
                            this.logger.error(`Failed to process product ${product.itemCode}: ${error.message}`);
                            throw error; // Stop processing this product batch
                        }
                    },
                    this.CONCURRENCY_LIMIT
                ),
                toArray()
            )
        );
    }
}

