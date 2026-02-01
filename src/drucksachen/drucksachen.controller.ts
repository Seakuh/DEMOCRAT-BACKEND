import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { DrucksachenService, DrucksacheQuery } from './drucksachen.service';

@Controller('drucksachen')
export class DrucksachenController {
  constructor(private drucksachenService: DrucksachenService) {}

  @Get('search')
  async search(@Query('q') q: string, @Query() query: DrucksacheQuery) {
    return this.drucksachenService.findAll({ ...query, search: q });
  }

  @Get()
  async findAll(@Query() query: DrucksacheQuery) {
    return this.drucksachenService.findAll(query);
  }

  @Get('ressorts')
  async getRessorts() {
    return this.drucksachenService.getRessorts();
  }

  @Get('categories')
  async getCategories() {
    return this.drucksachenService.getCategories();
  }

  @Get('conferences')
  async getConferences() {
    return this.drucksachenService.getConferences();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const drucksache = await this.drucksachenService.findById(id);
    if (!drucksache) {
      throw new NotFoundException('Drucksache nicht gefunden');
    }
    return drucksache;
  }
}
