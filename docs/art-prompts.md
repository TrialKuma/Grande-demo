# Demo art generation

## Expedition recruits portrait atlas · 3.0

- Output: `public/art/recruits.png`.
- Source: built-in `image_gen.imagegen`, generated 2026-09-07.
- Original source file: `C:/Users/A/.codex/generated_images/01a0729c-6f1d-70c2-b7ea-295d67504b4d/exec-22497b19-e534-486a-95e1-d5d83e613a0c.png`.
- Original demo characters: Lumen / 露弥 (left), Voss / 沃斯 (right). CSS enlarges the atlas to 300% auto with horizontal positions 12.5% / 87.5%, preserving each panel's center while framing the faces more closely at small sizes.
- Used for recruitment cards, dialogue portraits, camp and combat HUD. Included in the standalone offline file.

### Final prompt

```text
Use case: stylized-concept. Create one production game portrait atlas, two equal width vertical panels edge-to-edge, total image 1024x768. Original dark fantasy science-fantasy party portraits for a Chinese RPG named Grande. Painterly finely detailed illustrative rendering, atmospheric dark navy background, fine gold rim lighting, confident readable faces. NO TEXT, NO typography, NO watermark, NO borders. Left half: Lumen, adult woman prism field medic, pale gold chin-length hair with one teal ribbon, mature composed attentive face, blue grey eyes, ivory and muted teal armored medical coat with small luminous prism at collar, elegant short crystal staff partly visible, waist-up portrait centered exactly at x25%, eyes at y28%, head entirely visible with generous 10% top margin. Right half: Voss, adult man ash vanguard, broad strong build, brown skin, cropped black hair with a silver temple streak, sober weathered face with short stubble, dark charcoal and red copper plate armor, red ember lines, battered heavy shield edge visible at shoulder, waist-up portrait centered exactly at x75%, eyes at y28%, head entirely visible with same margin. Both facing slightly toward center, equal head sizes. Fully separate panels so CSS can crop each half as an individual portrait. Art should feel like coherent high quality illustrated RPG character selection portraits, readable at 50px thumbnail. Two adult original characters only.
```

## Party portrait atlas

- Output: `public/art/party.png`
- Dimensions: 1536 × 1024.
- Source: built-in `image_gen.imagegen` tool; generated on 2026-09-06.
- Inspected design reference: `../Ric-Others/艾佩莉雅_images/image1.jpeg`. The image was inspected for the established pink hair / white, black, pink mechanical outfit concept. It was not supplied as an image edit target.
- Original demo visual choices: Knibbs and Ric clothing, faces and color accents; painterly common style.
- Layout: left Knibbs / center Apeilia / right Ric. Use CSS background-size: 300% auto; background-position-x: 0%, 50%, 100%. Tune background-position-y for the card aspect ratio; at square portraits 12% shows faces well, while tall 1:2 cards can show the full one-third region.

### Final prompt

```text
Use case: stylized-concept
Asset type: ONE horizontal character portrait atlas asset for a dark fantasy JRPG combat game. Landscape 1536x1024 composition, three equal-width portrait regions with NO dividing lines, NO letters, NO logos, NO interface.
Primary request: Three premium painterly head-and-chest character portraits, detailed semi-realistic anime faces, coherent dark fantasy art direction and matching scale. Every person is an adult. Each character stays inside their own one-third region, is centered in that region, has top of head around 12% of image height and shoulders/chest extending to the bottom. These regions will be cropped individually.
Left third, centered at 16.67% image width: Knibbs, rugged 48-year-old male adventurer with swept back dark ash hair and gray temples, short beard, warm gold eyes, orange scarf, dark brown/navy coat, a revolver visible near his shoulder, muted gold smoke. Weathered face and resolute calm expression.
Middle third, centered at 50% image width: Apeilia, adult female humanoid android with long vivid pink hair, pink mechanical ear modules, sleek black-and-white mechanical outfit with pink trim, confident amused eyes. Cyan and pink glow from futuristic modules. Tasteful armored upper torso. The established visual reference is pink long hair and white/black/pink high-tech armor; create an original polished adaptation in this shared dark fantasy portrait style.
Right third, centered at 83.33% image width: Ric, mysterious androgynous masculine-presenting adult bartender and exorcist, silver hair, small knowing smirk, white shirt, black waistcoat, dark purple jacket, violet glowing talismans near one raised hand, violet fog.
Style/medium: High-end painterly game illustration; subtle textured brushwork, attractive coherent faces, nuanced material details, cinematic rim lights, rich deep shadows, not chibi, not a photograph.
Scene/backdrop: Seamless dark smoky backdrop transitioning softly from muted amber on the left to cyan-magenta in the center and violet on the right. The three regions have equal visual weight.
Constraints: Exactly three separate people, one per equal third; no shared bodies, no overlapping across thirds, no divider lines, no borders, no text, no logo, no watermark, no UI. Same head scale and head height. No environment or full-body scene.
```

## Sanctuary title background

- Output: `public/art/title.png`
- Dimensions: 1536 × 1024.
- Source: built-in `image_gen.imagegen` tool; generated on 2026-09-06.
- Original demo environment concept: ruined crystal sanctuary; empty arena; teal/violet light and warm embers.
- Layout: title overlay can occupy the darker left half; use background-size: cover and centered positioning.

### Final prompt

```text
Use case: stylized-concept
Asset type: Original wide title background for the dark fantasy JRPG combat demo Grande, landscape 1536x1024.
Primary request: An awe-inspiring ruined ancient crystal sanctuary at night, no characters. Foreground is an empty circular stone ritual arena, its old engraved concentric stone rings reaching the lower frame, subtle fractured violet runes glowing in the seams. In the middle distance, weathered tall monoliths frame a floating shard of pale teal crystal high toward the right third of the image, surrounded by several small floating fragments. The ancient chamber opens toward a misty moonless abyss beyond broken gothic arches. Organic rock and damaged masonry, not a futuristic space station.
Style/medium: Premium painterly dark fantasy game key art, cinematic scale, rich textured stones, beautiful teal blue and violet atmospheric perspective with a few floating amber embers. Painterly detail coherent with semi-realistic anime RPG portraits.
Composition/framing: Wide establishing view slightly above the empty circular arena; main striking crystal landmark on the right half, left half has darker quieter atmosphere suitable for title typography overlaid separately. Deep foreground shadow, layered fog and depth.
Lighting/mood: Atmospheric mysterious calm before a battle, pale cyan crystal bounce light, subtle violet crevices, tiny warm gold embers. Readable forms and strong but soft contrast.
Constraints: No people, no creatures, no text, no letters, no logos, no UI, no border, no watermark, no screenshot. This is a reusable standalone background asset, not a designed title screen.
```
