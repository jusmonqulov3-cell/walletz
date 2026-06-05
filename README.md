# PulNazorat

AI-powered shaxsiy moliya ilovasi. Valyuta: O'zbek so'mi (UZS). Interfeys tili: o'zbekcha.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres).

## 1. Talablar

- Node.js 18.18+ (sinovdan o'tgan: Node 24)
- [Supabase](https://supabase.com) loyihasi (bepul reja yetarli)

## 2. `.env.local` ni to'ldirish

Loyiha ildizidagi `.env.local` faylida quyidagi o'zgaruvchilar bor — ularni Supabase loyiha sozlamalaridan oling:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

Qiymatlarni qayerdan olish:

- `NEXT_PUBLIC_SUPABASE_URL` va `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase Dashboard → **Project Settings → API** (Project URL va `anon` `public` key).
- `SUPABASE_SERVICE_ROLE_KEY` — o'sha sahifadagi `service_role` key (faqat serverda ishlatiladi, sirli saqlang).
- `ANTHROPIC_API_KEY` — [Anthropic Console](https://console.anthropic.com) (kelajakdagi AI funksiyalari uchun).

## 3. Ma'lumotlar bazasi sxemasini o'rnatish

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. `supabase/schema.sql` faylidagi barcha kodni nusxalab, tahrirlagichga joylashtiring.
3. **Run** tugmasini bosing.

Bu jadvallarni (`categories`, `expenses`, `incomes`, `budgets`), Row Level Security siyosatlarini (har bir foydalanuvchi faqat o'z ma'lumotlarini ko'radi) va standart kategoriyalarni yaratadi.

> **Eslatma:** Tez sinash uchun Supabase Dashboard → **Authentication → Providers → Email** bo'limida "Confirm email" ni o'chirib qo'yishingiz mumkin — shunda ro'yxatdan o'tgach darhol tizimga kirasiz.

## 4. Dasturni ishga tushirish

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) ni oching. Tizimga kirmagan foydalanuvchi `/login` ga yo'naltiriladi.

## Loyiha tuzilishi

```
src/
  app/
    login/page.tsx        # Kirish / Ro'yxatdan o'tish
    dashboard/page.tsx    # Himoyalangan boshqaruv paneli
    auth/actions.ts       # signOut server action
    page.tsx              # Sessiyaga qarab yo'naltirish
  lib/supabase/
    client.ts             # Brauzer klienti
    server.ts             # Server klienti
    middleware.ts         # Sessiyani yangilash + marshrutni himoyalash
  middleware.ts           # Next.js middleware kirish nuqtasi
supabase/
  schema.sql              # DB sxemasi + RLS + seed
```
