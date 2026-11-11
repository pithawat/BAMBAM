# CR-003 — New administration mascot assets

Date: 2026-10-26
Generation: built-in `image_gen.imagegen`, one request per asset, with `transparent_background: true`.

## Identity references

- `frontend/public/brand/bam-mascot-welcome.png`
- `frontend/public/brand/bam-mascot-tracking.png`

Both were inspected before generation. They are identity/style references, not edit targets.

## Deliverables and placement

| Role | Concept | Original | Web delivery |
|---|---|---|---|
| Admin | Facility planner: kneeling with a rolled plan and a small office model | `frontend/public/brand/bam-mascot-admin-planner.png` | `frontend/public/brand/bam-mascot-admin-planner-white.webp` (repair CR-029) |
| Superadmin | Access guardian: friendly shield/checkmark and raised key | `frontend/public/brand/bam-mascot-superadmin-guardian.png` | `frontend/public/brand/bam-mascot-superadmin-guardian-white.webp` (repair CR-029) |

Originals are 1254 × 1254 transparent PNGs. WebP delivery copies are 384 × 384, quality 88 with alpha quality 100 (42,708 and 36,990 bytes). Conversion only optimizes size/format; original generated art is retained unchanged. No generative content or background edits were performed after generation.

One pose is selected by viewer role beside the current settings page heading: 112px desktop, 72px mobile. It is decorative (`alt=""`, `aria-hidden="true"`), has explicit dimensions, and does not animate. The primary task remains in the main panel; CR-002's removed bars/logo/notification controls stay absent.

## Final generation prompts

### Admin — facility planner

```text
Use case: stylized-concept. Asset type: transparent PNG mascot cutout for a Thai workplace administration UI. Input image 1 and image 2 are CHARACTER IDENTITY AND RENDER STYLE REFERENCES only; create a new pose, not a copy of either pose. Create ONE adorable BAM orange tiger cub, exactly matching the references: huge round amber-brown eyes, small pink nose, white fluffy cheek ruff and muzzle, brown-black stripes, round furry ears, plump chibi proportions, royal cobalt blue polo with exact white text "BAM" on the left chest, navy trousers, white sneakers with cobalt side accents, striped curved tail. New concept: THE LITTLE FACILITY PLANNER. The tiger is in a compact playful half-kneeling pose beside a small simple white-and-blue office building model, one paw gently resting on its roof while the other hugs a rolled blue-and-white architectural plan. Look warmly toward the viewer, head slightly tilted, confident small happy smile. Large head and readable silhouette for display at 96–112 px. The building is a modest supporting prop, not a scene. Match the original premium 3D animated-film look, detailed soft fur, realistic polo fabric, gentle studio light and crisp clean edges. Show the entire tiger including both shoes, tail and props; center the compact composition with 5–7% transparent margin. Square canvas. Background must be truly transparent alpha, NOT black, white or a checkerboard; no environment, no floor plane, no cast shadow backdrop, no captions or watermark, no other characters. Keep the recognisable BAM tiger identity and clothing.
```

### Superadmin — access guardian

```text
Use case: stylized-concept. Asset type: transparent PNG mascot cutout for a Thai workplace Superadmin permissions UI. Input image 1 and image 2 are CHARACTER IDENTITY AND RENDER STYLE REFERENCES only; create a new pose, not a copy of either pose. Create ONE adorable BAM orange tiger cub, exactly matching the references: huge round amber-brown eyes, small pink nose, white fluffy cheek ruff and muzzle, brown-black stripes, round furry ears, plump chibi proportions, royal cobalt blue polo with exact white text "BAM" on the left chest, navy trousers, white sneakers with cobalt side accents, striped curved tail. New concept: THE FRIENDLY ACCESS GUARDIAN. Standing with a slight lively sideways lean and feet close together, the tiger hugs a small rounded cobalt-blue shield with a single clear white checkmark in one paw; the other paw proudly lifts a small silver key with a blue round handle at shoulder height. Both eyes open with a warm reassuring smile, no stern expression. Shield and key are simple readable props; no armour, no cape, no helmet. Large head and readable silhouette for display at 96–112 px. Match the original premium 3D animated-film look, detailed soft fur, realistic polo fabric, gentle studio light and crisp clean edges. Show entire tiger including both shoes, tail and props; center a compact balanced composition with 5–7% transparent margin. Square canvas. Background must be truly transparent alpha, NOT black, white or a checkerboard; no environment, no floor plane, no cast shadow backdrop, no captions or watermark, no other characters. Keep the recognisable BAM tiger identity and clothing.
```

## Validation

- Visually inspected both generated characters against the supplied tiger references.
- Checked true alpha channels with both transparent background pixels and visible foreground pixels; delivery files retain alpha.
- Prototype checks verify the correct pose per viewer, successful local image loading, responsive layouts and the existing interactions. Browser previews cover Desktop and mobile.

