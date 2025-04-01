import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ItemsService } from './items.service.js';
import { Item } from '@prisma/client';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all items' })
  @ApiResponse({ status: 200, description: 'Returns all items' })
  async findAll(): Promise<Item[]> {
    return this.itemsService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search items by name' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of results to return' })
  @ApiResponse({ status: 200, description: 'Returns matching items' })
  async search(
    @Query('query') query: string,
    @Query('limit') limit?: number,
  ): Promise<Item[]> {
    return this.itemsService.search(query, limit);
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Get item by barcode' })
  @ApiParam({ name: 'barcode', description: 'Item barcode' })
  @ApiResponse({ status: 200, description: 'Returns the item' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async findByBarcode(@Param('barcode') barcode: string): Promise<Item> {
    return this.itemsService.findByBarcode(barcode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({ status: 200, description: 'Returns the item' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async findOne(@Param('id') id: string): Promise<Item> {
    return this.itemsService.findOne(id);
  }
} 
