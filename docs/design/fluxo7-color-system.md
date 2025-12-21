# Fluxo7 – Sistema de Cores (Estilo Ísis)

Este documento concentra a paleta, tokens e padrões visuais do loading/branding da Ísis Cliente para reaproveitar na landing da Fluxo7. O objetivo é garantir um visual moderno, escuro (dark), com acentos em laranja/âmbar e efeitos de luz/glow.

---

## Visão Geral
- Base dark minimalista com superfícies discretas.
- Duo de destaque: laranja intenso + âmbar/dourado.
- Textos claros e contrastantes.
- Efeitos-chave: blobs radiais, glow pulsante, neon em títulos e shimmer sutil.

---

## Paleta

- Background: `#0A0A0A`
- Surface: `#121212`
- Surface-2: `#1E1E1E`
- Texto primário: `#F5F5F5`
- Texto secundário: `#A3A3A3`
- Texto muted: `#737373`

Duo “Fluxo” (acentos e efeitos):
- Laranja intenso: `#FF6600`
- Âmbar/dourado: `#FFAA33`
- Gold highlight: `#FFD700`

Brand HSL (tema):
- `--brand-hsl: 38 92% 50%` (≈ `#F59E0B`)

---

## Tokens (CSS Variables)
Cole no `:root` da landing (ou garanta a mesma definição global):

```css
:root {
  /* Base dark */
  --background: 240 0% 4%;   /* #0A0A0A */
  --surface: 0 0% 7%;        /* #121212 */
  --surface-2: #1E1E1E;

  --text-primary: #F5F5F5;
  --text-secondary: #A3A3A3;
  --text-muted: #737373;

  /* Brand */
  --brand-hsl: 38 92% 50%;   /* ~ #F59E0B */
  --brand: hsl(var(--brand-hsl));
  --brand-600: #FF6600;
  --brand-500: hsl(var(--brand-hsl)); /* ~ #F59E0B */
  --brand-400: #FFAA33;
  --brand-300: #FFD700;

  /* Shadows / Ring */
  --shadow-1: 0 4px 14px rgba(0,0,0,.25);
  --shadow-2: 0 8px 24px rgba(0,0,0,.35);
  --ring: 0 0 0 3px hsl(var(--brand-hsl) / 0.25);

  /* Radii */
  --radius: 16px;
  --radius-sm: 10px;
}
```

Se a landing já usa o mesmo Tailwind do app, esses tokens se integram diretamente via `tailwind.config.js` (cores `background`, `surface`, `brand`, `text-*`).

---

## Mapeamento Tailwind (existente no projeto)

- Cores globais:
  - `bg-background` → `hsl(var(--background))`
  - `bg-surface` → `hsl(var(--surface))`
  - `text-text-primary` → `var(--text-primary)`
  - `text-text-secondary` → `var(--text-secondary)`
  - `text-text-muted` → `var(--text-muted)`
  - `text-brand` / `bg-brand` → `hsl(var(--brand-hsl))`
- Sombras/Ring:
  - `shadow-1`, `shadow-2`, `shadow-ring` (mapeados para `--shadow-*` e `--ring`)
- Radius:
  - `rounded-xl` conforme `--radius` (tema suavizado/premium)

Sugestões rápidas:
- Cartões: `bg-surface/70 backdrop-blur-sm border border-white/10 shadow-[var(--shadow-2)] rounded-xl`
- Botão primário: `bg-[hsl(var(--brand-hsl))] text-black hover:brightness-110 focus:ring-[var(--ring)]`

---

## Efeitos (CSS puros)

### 1) Fundo com blobs radiais (luzes)
```css
.hero {
  position: relative;
  background: hsl(var(--background));
  overflow: hidden;
}
.hero::before, .hero::after {
  content: "";
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle at 20% 50%, #FF6600 0%, transparent 50%),
              radial-gradient(circle at 80% 50%, #FFAA33 0%, transparent 50%),
              radial-gradient(circle at 50% 20%, #FF6600 0%, transparent 50%);
  opacity: .18;
  filter: saturate(1.1);
  animation: hero-blobs 8s ease-in-out infinite alternate;
}
.hero::after { animation-delay: -4s; }
@keyframes hero-blobs {
  0%   { transform: translate3d(-2%, -1%, 0) scale(1); }
  100% { transform: translate3d(2%, 1%, 0) scale(1.05); }
}
```

### 2) Partículas flutuantes
```css
.particles { position: absolute; inset: 0; pointer-events: none; }
.particle {
  position: absolute; width: 8px; height: 8px; border-radius: 9999px;
  background: var(--brand-400);
  opacity: 0; animation: float 4.5s ease-in-out infinite;
}
.particle.alt { background: var(--brand-600); animation-duration: 5.5s; }
@keyframes float {
  0%   { transform: translateY(0) scale(.6); opacity: 0; }
  30%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translateY(-80px) scale(.9); opacity: 0; }
}
```

### 3) Glow pulsante (logos/ícones)
```css
.glow { position: relative; }
.glow::before {
  content: ""; position: absolute; inset: -10%;
  border-radius: 16px; background: var(--brand-400);
  filter: blur(18px); opacity: .55;
  animation: pulse 2.2s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { transform: scale(1);   opacity: .45; }
  50%     { transform: scale(1.12); opacity: .8; }
}
```

### 4) Neon text glow (títulos)
```css
.neon-fluxo { color: #FF6600; text-shadow: 0 0 10px rgba(255,102,0,.5), 0 0 20px rgba(255,102,0,.8); }
.neon-7     { color: #FFAA33; text-shadow: 0 0 10px rgba(255,170,51,.5), 0 0 20px rgba(255,170,51,.8); }
.neon-muted { color: #B0B0B0; }
```

### 5) Barra shimmer
```css
.shimmer {
  position: relative; overflow: hidden; border-radius: 9999px;
  height: 4px; background: rgba(255,255,255,.08);
}
.shimmer::before {
  content: ""; position: absolute; inset: 0; width: 40%;
  background: linear-gradient(90deg, var(--brand-400), var(--brand-300), var(--brand-400));
  animation: slide 2.2s ease-in-out infinite;
}
@keyframes slide {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
```

---

## Exemplo de Hero (HTML)

```html
<section class="hero relative min-h-[70vh] flex items-center">
  <div class="particles">
    <span class="particle" style="left:12%; top:64%"></span>
    <span class="particle alt" style="left:46%; top:72%"></span>
    <span class="particle" style="left:78%; top:18%"></span>
  </div>

  <div class="container mx-auto px-6 relative z-10">
    <div class="max-w-3xl">
      <div class="inline-flex glow rounded-2xl p-4 bg-[hsl(var(--surface))] border border-white/10 shadow-[var(--shadow-2)]">
        <svg width="28" height="28" viewBox="0 0 24 24" class="text-white/90"><!-- ícone --></svg>
      </div>

      <h1 class="mt-6 leading-tight font-extrabold text-5xl md:text-6xl">
        <span class="neon-fluxo">Fluxo</span><span class="neon-7">7</span>
        <span class="neon-muted ml-2">Arena</span>
      </h1>

      <p class="mt-4 text-lg text-text-secondary max-w-2xl">
        Inteligência, performance e uma experiência premium para sua gestão esportiva.
      </p>

      <div class="mt-8 flex items-center gap-4">
        <a href="#contato" class="px-6 py-3 rounded-xl bg-[hsl(var(--brand-hsl))] text-black font-semibold hover:brightness-110 focus:outline-none focus:ring-[var(--ring)] transition">
          Falar com a Fluxo7
        </a>
        <a href="#cases" class="px-6 py-3 rounded-xl bg-[hsl(var(--surface))] text-text-primary border border-white/10 hover:border-[hsl(var(--brand-hsl))] transition">
          Ver cases
        </a>
      </div>

      <div class="mt-8 shimmer"></div>
    </div>
  </div>
</section>
```

---

## Boas Práticas
- Use `bg-background` e `bg-surface` para manter o contraste dark.
- Reserve `#FF6600`/`#FFAA33` para títulos/acentos/glows; `#FFD700` para highlights.
- Prefira `rounded-xl/2xl` e sombras suaves para uma sensação premium.
- Em botões, use brand HSL (`hsl(var(--brand-hsl))`) para consistência com o app.

---

## Referências no Projeto
- Componente: `src/components/isis/IsisPremiumLoading.jsx`
- Tema: `tailwind.config.js` e `src/index.css`
