# Imagens do novo layout

Criadas em 6 de novembro de 2026 com a ferramenta nativa Imagegen, com `transparent_background: true`. São imagens ilustrativas, não fotografias dos produtos reais da Tadalas. A logo existente não foi modificada. Nenhuma imagem contém marca de terceiros, preço ou oferta.

## Arquivos

Arquivos em `public/assets/images/`:

| Arquivo WebP                            | Dimensões  | Uso                                 |
| --------------------------------------- | ---------- | ----------------------------------- |
| `hero-meal-illustrative.webp`           | 1000 × 667 | Combo do destaque e faixa de combos |
| `burger-cutout-illustrative.webp`       | 700 × 467  | Hambúrguer isolado                  |
| `fries-cutout-illustrative.webp`        | 500 × 500  | Categoria de acompanhamentos        |
| `drink-cutout-illustrative.webp`        | 500 × 500  | Categoria de bebidas                |
| `hero-meal-illustrative-thumb.webp`     | 400 × 267  | Miniatura do combo                  |
| `burger-cutout-illustrative-thumb.webp` | 400 × 267  | Miniatura do hambúrguer             |

As cópias PNG com os mesmos nomes-base preservam transparência e estão no mesmo diretório. Os originais gerados foram preservados no diretório de imagens geradas do Codex. As imagens servidas foram redimensionadas proporcionalmente com .NET e convertidas para WebP com Sharp, qualidade 84 e alpha 100, sem alteração criativa. Sharp foi instalado somente em `var/image-optimizer/`, que é ignorado pelo Git; não é uma dependência da aplicação.

Validação: imagens inspecionadas visualmente; PNGs com canal ARGB e canto transparente; WebPs com `hasAlpha: true`. Usar um aviso de imagem ilustrativa onde aparecerem como representação de comida. Fotos reais cadastradas no painel continuam tendo prioridade nos componentes de catálogo.

## Prompts finais

### Combo

Use case: product-mockup. Asset type: transparent cutout food photograph for the hero of a Brazilian burger restaurant website. Primary request: a beautifully appetizing full burger meal, with a large brioche cheeseburger in the foreground, thick grilled beef patty, melted cheddar, lettuce and tomato; golden fries in a plain warm orange carton behind it; and a cold cola in a plain dark navy cup with ice behind to the side. Scene/backdrop: genuinely transparent alpha background, isolated meal, no environment, no solid background. Composition: landscape approximately 3:2, all items fully visible, frontal three-quarter view, food fills most of frame with a narrow safe margin, no cropping. Lighting: refined professional commercial food photography, soft bright highlights, natural texture, subtle grounding shadow with transparent edges. Constraints: no words, no logos, no branding, no watermark, no people, no hands, no floating toppings. This is illustrative food imagery, not a photograph of a real restaurant product.

### Hambúrguer

Use case: product-mockup. Asset type: transparent cutout food photograph for a Brazilian burger restaurant menu card. Primary request: one single beautifully appetizing cheeseburger, glossy toasted brioche bun, thick grilled beef patty, melted cheddar, lettuce and tomato. Scene/backdrop: genuinely transparent alpha background, isolated burger, no environment, no solid background. Composition: landscape approximately 3:2, entire burger fully visible, frontal three-quarter view, centered, fills most of frame with generous safe margin, no cropping. Lighting: refined professional commercial food photography, soft bright highlights, natural texture, extremely subtle grounding shadow with transparent edges. Constraints: no other objects, no words, no logos, no branding, no watermark, no people, no hands, no floating toppings. This is illustrative food imagery, not a photograph of a real restaurant product.

### Acompanhamento

Use case: product-mockup. Asset type: transparent cutout food photograph for a Brazilian burger restaurant menu category card. Primary request: a generous portion of crispy golden French fries in a simple plain warm orange paper carton. Scene/backdrop: genuinely transparent alpha background, isolated fries carton, no environment, no solid background. Composition: square, entire carton and all fries fully visible, frontal three-quarter view, centered, fills 80 percent of frame with a safe margin, no cropping. Lighting: refined professional commercial food photography, soft bright highlights, natural crispy potato texture, extremely subtle grounding shadow with transparent edges. Constraints: no other objects, no burger, no words, no logos, no branding, no watermark, no people, no hands. This is illustrative food imagery, not a photograph of a real restaurant product.

### Bebida

Use case: product-mockup. Asset type: transparent cutout beverage photograph for a Brazilian burger restaurant menu category card. Primary request: one simple clear unbranded tumbler filled with cold dark cola and beautiful translucent ice cubes, fresh condensation on the outside. Scene/backdrop: genuinely transparent alpha background, isolated glass, no environment, no solid background. Composition: square, entire glass fully visible, frontal three-quarter view, centered, fills 80 percent of height with safe margin, no cropping. Lighting: refined professional commercial beverage photography, soft bright highlights, natural bubbles and glass texture, extremely subtle grounding shadow with transparent edges. Constraints: no other objects, no straw, no words, no logos, no branding, no watermark, no people, no hands. This is illustrative beverage imagery, not a photograph of a real restaurant product.
