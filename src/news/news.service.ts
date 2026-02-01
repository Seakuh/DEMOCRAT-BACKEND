import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly rssUrl = 'https://www.bundestag.de/static/appdata/includes/rss/hib.rss';
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  async getNews() {
    try {
      const response = await axios.get(this.rssUrl);
      const jsonObj = this.parser.parse(response.data);
      
      const items = jsonObj.rss.channel.item;
      
      // Falls nur ein Item vorhanden ist, wird es als Objekt statt Array zurückgegeben
      const newsItems = Array.isArray(items) ? items : [items];

      return newsItems.map(item => ({
        title: item.title,
        link: item.link,
        description: item.description,
        pubDate: item.pubDate,
        category: Array.isArray(item.category) ? item.category : [item.category],
        guid: item.guid?.['#text'] || item.guid,
      }));
    } catch (error) {
      this.logger.error(`Fehler beim Abrufen des RSS-Feeds: ${error.message}`);
      throw error;
    }
  }
}
