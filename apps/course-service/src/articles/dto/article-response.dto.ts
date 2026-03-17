import { ApiProperty } from '@nestjs/swagger';
// import { ArticleContentItem } from './create-article.dto';

export class ArticleResponseDto {
  @ApiProperty({ description: 'Article ID', example: 1 })
  article_id: number;

  @ApiProperty({ description: 'Lesson ID this article belongs to', example: 1 })
  lesson_id: number;

  @ApiProperty({
    description: 'Article content as array of { url, article } items',
    example: [
      { image_id: 123, article: 'This is a sample article block', order: 1 },
    ],
  })
  article_content: any[];
}
