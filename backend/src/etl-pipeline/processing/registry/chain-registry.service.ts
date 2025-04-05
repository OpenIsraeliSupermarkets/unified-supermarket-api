import { Injectable, Logger } from '@nestjs/common';
import { SupermarketChain } from '../../data-access.service.js';
import { Transformer } from '../transformers/transformer.js';
import { StoreNormalizer, ItemNormalizer } from '../normalization/store-normalizer.interface.js';
import { ShufersalTransformerService } from '../transformers/shufersal-transformer.service.js';
import { HaziHinamTransformerService } from '../transformers/hazi-hinam-transformer.service.js';
import { UniformItem, UniformStore } from '../../schemas/uniform/index.js';
// Import other transformers and normalizers as needed

/**
 * Registry structure for a supermarket chain
 */
interface ChainRegistryEntry {
    chain: SupermarketChain;
    processors: ChainProcessors;
}

interface ChainProcessors {
    transformer: Transformer;
    normalizers?: [
        StoreNormalizer?,
        ItemNormalizer?
    ];
}

/**
 * Central registry for all chain-specific components
 * Maps each chain to its transformer and optional normalizers
 */
@Injectable()
export class ChainRegistryService {
    private readonly logger = new Logger(ChainRegistryService.name);
    private readonly registry = new Map<SupermarketChain, ChainRegistryEntry>();

    constructor(
        private readonly shufersalTransformer: ShufersalTransformerService,
        private readonly haziHinamTransformer: HaziHinamTransformerService,
    ) {
        this.initializeRegistry([
            { chain: SupermarketChain.SHUFERSAL, processors: { transformer: this.shufersalTransformer, normalizers: [] } },
            { chain: SupermarketChain.HAZI_HINAM, processors: { transformer: this.haziHinamTransformer, normalizers: [] } },
        ]);
    }

    public getTransformer(chain: SupermarketChain): Transformer {
        try {
            return this.registry.get(chain)!.processors.transformer;
        } catch (error) {
            this.logger.error(`No transformer found for chain: ${chain}`);
            throw error;
        }
    }


    /**
     * Initialize the registry with all supported chains
     */
    private initializeRegistry(
        chainProcessors: ChainRegistryEntry[]
    ): void {
        this.logger.log('Initializing chain registry...');

        for (const chainProcessor of chainProcessors) {
            this.registry.set(chainProcessor.chain, chainProcessor);
        }

        this.logger.debug(`Successfully initialized registry with ${this.registry.size} chains`);
        const registryEntries = Array.from(this.registry.entries()).map(([chain, entry]) => ({
            chain,
            transformer: entry.processors.transformer.constructor.name,
            normalizers: entry.processors.normalizers?.map(n => n?.constructor.name) || []
        }));

        this.logger.debug('Registry:');
        registryEntries.forEach(entry => {
            this.logger.debug(`Chain: ${entry.chain}`);
            this.logger.debug(`  Transformer: ${entry.transformer}`);
            this.logger.debug(`  Normalizers: ${entry.normalizers.join(', ')}`);
        });
    }

} 
