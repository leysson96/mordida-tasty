# Mordida Tasty - Guia visual

Estado actualizado: 2026-08-31

## Paleta base

La paleta sale del logo oficial de Mordida Tasty y busca tres sensaciones:
hambre, confianza y limpieza.

- Vino oscuro `#5a070b`: color principal de marca. Se usa en acciones
  importantes, marca, estados destacados y elementos que deben sentirse serios.
- Vino profundo `#350305`: variante oscura para hover, contraste y fondos
  intensos.
- Naranja tostado `#bd5a08`: acento de apetito y energia. Se usa como apoyo,
  no como color dominante.
- Naranja luminoso `#e08a28`: acento legible sobre fondos oscuros, sobre todo
  en portada y senales pequenas.
- Papel calido `#fff5e9`: fondo principal. Da calidez de restaurante sin verse
  sucio ni pesado.
- Superficie clara `#fffaf4` y blanco `#ffffff`: formularios, paneles y areas
  de lectura.
- Tinta cacao `#211512`: texto principal. Es mas calido que negro puro.
- Verde `#23715a`: solo para estados de exito, servicio abierto y mensajes OK.

## Donde se cambia

Los colores globales estan en:

`apps/web/app/globals.css`

Bloque:

```css
:root {
  --color-brand: #5a070b;
  --color-accent: #bd5a08;
  --color-paper: #fff5e9;
}
```

Cambiar esas variables actualiza botones, tabs, portada, paneles, foco de
formularios y elementos compartidos en toda la pagina.

## Regla de uso

El vino oscuro manda. El naranja acompana. El fondo debe respirar.

Si todo se vuelve naranja, la pagina pierde profesionalidad. Si todo se vuelve
oscuro, deja de abrir apetito. Por eso la combinacion correcta es: fondos
claros, texto cacao, botones vino y pequenos acentos naranjas.
