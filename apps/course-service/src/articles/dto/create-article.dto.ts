import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  Min,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ArticleContentItem {
  @ApiPropertyOptional({
    description: 'Image URL',
    example: 'https://cdn.example.com/image.png',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Article text associated with the URL',
    example: 'Image caption or paragraph text',
  })
  @IsString()
  article: string;

  @ApiPropertyOptional({
    description: 'Order index of this content item',
    example: 1,
  })
  @IsNumber()
  order: number;
}

export class CreateArticleDto {
  @ApiProperty({ description: 'Lesson ID this article belongs to', example: 1 })
  @IsNumber()
  @Min(1)
  lesson_id: number;

  @ApiPropertyOptional({
    description: 'Article content array',
    example: [
      {
        imageUrl: 'https://cdn.example.com/image.png',
        article: 'Some text',
        order: 1,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArticleContentItem)
  article_content?: ArticleContentItem[];
}
