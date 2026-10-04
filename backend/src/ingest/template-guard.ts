import { BadRequestException } from '@nestjs/common';
import { Screen, TemplateType } from '../screens/screen.entity';

/** API anahtarının bağlı olduğu ekran beklenen şablonda mı? */
export function assertTemplate(screen: Screen, template: TemplateType) {
  if (screen.template !== template) {
    throw new BadRequestException(
      `This endpoint only works with ${template} screens (this screen: ${screen.template})`,
    );
  }
}
