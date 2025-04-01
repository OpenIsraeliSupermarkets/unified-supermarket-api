import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChainsService } from './chains.service.js';

@ApiTags('chains')
@Controller('chains')
export class ChainsController {
  constructor(private chainsService: ChainsService) {
  }

  @Get()
  @ApiOperation({ summary: 'Get all chains' })
  @ApiResponse({ status: 200, description: 'Return all chains.' })
  findAll(@Query('includeStores') includeStores: boolean = false) {
    return this.chainsService.findAll(includeStores);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a chain by id' })
  @ApiResponse({ status: 200, description: 'Return the chain.' })
  @ApiResponse({ status: 404, description: 'Chain not found.' })
  findOne(@Param('id') id: string, @Query('includeStores') includeStores: boolean = false) {
    return this.chainsService.findOne(id, includeStores);
  }

  @Get(':id/stores')
  @ApiOperation({ summary: 'Get stores for a specific chain' })
  @ApiResponse({ status: 200, description: 'Return stores for the chain.' })
  @ApiResponse({ status: 404, description: 'Chain not found.' })
  async findStores(@Param('id') id: string) {
    const chain = await this.chainsService.findOne(id);
    return chain.stores;
  }


} 
