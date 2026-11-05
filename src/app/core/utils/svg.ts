import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Los íconos son SVG constantes del proyecto (nunca texto del usuario), pero el
 * saneador de Angular descarta el contenido SVG cuando se asigna con
 * `innerHTML`. Se salta el saneador únicamente para esos strings conocidos.
 */
export function svgConfiable(sanitizer: DomSanitizer, svg: string): SafeHtml {
  return sanitizer.bypassSecurityTrustHtml(svg);
}
