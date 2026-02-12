# Tailwind CSS Utilities Reference

**Source**: https://tailwindcss.com/docs  
**Last Updated**: February 3, 2026  
**Status**: ✅ VERIFIED (Official Tailwind Documentation)

---

## 📚 Overview

Tailwind CSS is a utility-first CSS framework. This reference covers the most commonly used utilities for building Vaughan-Tauri's wallet UI.

---

## 🎨 Layout

### Display

```html
<!-- Block -->
<div class="block">...</div>

<!-- Inline Block -->
<span class="inline-block">...</span>

<!-- Flex -->
<div class="flex">...</div>

<!-- Inline Flex -->
<div class="inline-flex">...</div>

<!-- Grid -->
<div class="grid">...</div>

<!-- Hidden -->
<div class="hidden">...</div>
```

---

### Flexbox

**Direction**:
```html
<div class="flex flex-row">...</div>      <!-- Horizontal -->
<div class="flex flex-col">...</div>      <!-- Vertical -->
<div class="flex flex-row-reverse">...</div>
<div class="flex flex-col-reverse">...</div>
```

**Justify Content** (main axis):
```html
<div class="flex justify-start">...</div>
<div class="flex justify-center">...</div>
<div class="flex justify-end">...</div>
<div class="flex justify-between">...</div>
<div class="flex justify-around">...</div>
```

**Align Items** (cross axis):
```html
<div class="flex items-start">...</div>
<div class="flex items-center">...</div>
<div class="flex items-end">...</div>
<div class="flex items-stretch">...</div>
```

**Gap**:
```html
<div class="flex gap-2">...</div>   <!-- 0.5rem -->
<div class="flex gap-4">...</div>   <!-- 1rem -->
<div class="flex gap-6">...</div>   <!-- 1.5rem -->
<div class="flex gap-8">...</div>   <!-- 2rem -->

<!-- Separate X and Y -->
<div class="flex gap-x-4 gap-y-2">...</div>
```

---

### Grid

**Columns**:
```html
<div class="grid grid-cols-1">...</div>   <!-- 1 column -->
<div class="grid grid-cols-2">...</div>   <!-- 2 columns -->
<div class="grid grid-cols-3">...</div>   <!-- 3 columns -->
<div class="grid grid-cols-12">...</div>  <!-- 12 columns -->
```

**Gap**:
```html
<div class="grid gap-4">...</div>
<div class="grid gap-x-4 gap-y-2">...</div>
```

---

### Spacing

**Padding**:
```html
<div class="p-4">...</div>      <!-- All sides: 1rem -->
<div class="px-4">...</div>     <!-- Horizontal: 1rem -->
<div class="py-4">...</div>     <!-- Vertical: 1rem -->
<div class="pt-4">...</div>     <!-- Top: 1rem -->
<div class="pr-4">...</div>     <!-- Right: 1rem -->
<div class="pb-4">...</div>     <!-- Bottom: 1rem -->
<div class="pl-4">...</div>     <!-- Left: 1rem -->
```

**Margin**:
```html
<div class="m-4">...</div>      <!-- All sides: 1rem -->
<div class="mx-auto">...</div>  <!-- Center horizontally -->
<div class="my-4">...</div>     <!-- Vertical: 1rem -->
<div class="mt-4">...</div>     <!-- Top: 1rem -->
<div class="-mt-4">...</div>    <!-- Negative top: -1rem -->
```

**Common spacing scale**:
- `0` = 0
- `1` = 0.25rem (4px)
- `2` = 0.5rem (8px)
- `3` = 0.75rem (12px)
- `4` = 1rem (16px)
- `6` = 1.5rem (24px)
- `8` = 2rem (32px)
- `12` = 3rem (48px)
- `16` = 4rem (64px)

---

### Sizing

**Width**:
```html
<div class="w-full">...</div>       <!-- 100% -->
<div class="w-1/2">...</div>        <!-- 50% -->
<div class="w-1/3">...</div>        <!-- 33.333% -->
<div class="w-64">...</div>         <!-- 16rem -->
<div class="w-screen">...</div>     <!-- 100vw -->
<div class="w-auto">...</div>       <!-- auto -->

<!-- Min/Max Width -->
<div class="min-w-0">...</div>
<div class="max-w-sm">...</div>     <!-- 24rem -->
<div class="max-w-md">...</div>     <!-- 28rem -->
<div class="max-w-lg">...</div>     <!-- 32rem -->
<div class="max-w-xl">...</div>     <!-- 36rem -->
```

**Height**:
```html
<div class="h-full">...</div>       <!-- 100% -->
<div class="h-screen">...</div>     <!-- 100vh -->
<div class="h-64">...</div>         <!-- 16rem -->
<div class="h-auto">...</div>       <!-- auto -->

<!-- Min/Max Height -->
<div class="min-h-screen">...</div>
<div class="max-h-screen">...</div>
```

---

## 🎨 Typography

### Font Size

```html
<p class="text-xs">...</p>      <!-- 0.75rem -->
<p class="text-sm">...</p>      <!-- 0.875rem -->
<p class="text-base">...</p>    <!-- 1rem -->
<p class="text-lg">...</p>      <!-- 1.125rem -->
<p class="text-xl">...</p>      <!-- 1.25rem -->
<p class="text-2xl">...</p>     <!-- 1.5rem -->
<p class="text-3xl">...</p>     <!-- 1.875rem -->
<p class="text-4xl">...</p>     <!-- 2.25rem -->
```

### Font Weight

```html
<p class="font-thin">...</p>        <!-- 100 -->
<p class="font-light">...</p>       <!-- 300 -->
<p class="font-normal">...</p>      <!-- 400 -->
<p class="font-medium">...</p>      <!-- 500 -->
<p class="font-semibold">...</p>    <!-- 600 -->
<p class="font-bold">...</p>        <!-- 700 -->
```

### Text Alignment

```html
<p class="text-left">...</p>
<p class="text-center">...</p>
<p class="text-right">...</p>
```

### Text Color

```html
<p class="text-black">...</p>
<p class="text-white">...</p>
<p class="text-gray-500">...</p>
<p class="text-blue-600">...</p>
<p class="text-red-500">...</p>
<p class="text-green-500">...</p>
```

### Text Truncation

```html
<p class="truncate">...</p>         <!-- Ellipsis -->
<p class="overflow-ellipsis">...</p>
<p class="whitespace-nowrap">...</p>
```

---

## 🎨 Colors

### Background Color

```html
<div class="bg-white">...</div>
<div class="bg-black">...</div>
<div class="bg-gray-100">...</div>
<div class="bg-blue-500">...</div>
<div class="bg-red-500">...</div>
<div class="bg-green-500">...</div>
<div class="bg-transparent">...</div>
```

**Color scale**: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900

---

### Border Color

```html
<div class="border border-gray-300">...</div>
<div class="border-2 border-blue-500">...</div>
```

---

## 🎨 Borders

### Border Width

```html
<div class="border">...</div>       <!-- 1px all sides -->
<div class="border-2">...</div>     <!-- 2px all sides -->
<div class="border-t">...</div>     <!-- Top only -->
<div class="border-r">...</div>     <!-- Right only -->
<div class="border-b">...</div>     <!-- Bottom only -->
<div class="border-l">...</div>     <!-- Left only -->
```

### Border Radius

```html
<div class="rounded">...</div>          <!-- 0.25rem -->
<div class="rounded-md">...</div>       <!-- 0.375rem -->
<div class="rounded-lg">...</div>       <!-- 0.5rem -->
<div class="rounded-xl">...</div>       <!-- 0.75rem -->
<div class="rounded-2xl">...</div>      <!-- 1rem -->
<div class="rounded-full">...</div>     <!-- 9999px (circle) -->

<!-- Individual corners -->
<div class="rounded-t-lg">...</div>     <!-- Top corners -->
<div class="rounded-tl-lg">...</div>    <!-- Top-left -->
```

---

## 🎨 Effects

### Shadow

```html
<div class="shadow-sm">...</div>
<div class="shadow">...</div>
<div class="shadow-md">...</div>
<div class="shadow-lg">...</div>
<div class="shadow-xl">...</div>
<div class="shadow-2xl">...</div>
<div class="shadow-none">...</div>
```

### Opacity

```html
<div class="opacity-0">...</div>    <!-- 0% -->
<div class="opacity-50">...</div>   <!-- 50% -->
<div class="opacity-75">...</div>   <!-- 75% -->
<div class="opacity-100">...</div>  <!-- 100% -->
```

---

## 🎨 Interactivity

### Cursor

```html
<button class="cursor-pointer">...</button>
<button class="cursor-not-allowed">...</button>
<div class="cursor-default">...</div>
```

### Pointer Events

```html
<div class="pointer-events-none">...</div>
<div class="pointer-events-auto">...</div>
```

### User Select

```html
<div class="select-none">...</div>
<div class="select-text">...</div>
<div class="select-all">...</div>
```

---

## 🎨 Hover, Focus, Active States

### Hover

```html
<button class="bg-blue-500 hover:bg-blue-600">...</button>
<a class="text-blue-500 hover:text-blue-700">...</a>
<div class="opacity-50 hover:opacity-100">...</div>
```

### Focus

```html
<input class="border focus:border-blue-500" />
<input class="outline-none focus:ring-2 focus:ring-blue-500" />
```

### Active

```html
<button class="bg-blue-500 active:bg-blue-700">...</button>
```

### Disabled

```html
<button class="disabled:opacity-50 disabled:cursor-not-allowed">
  ...
</button>
```

---

## 📱 Responsive Design

### Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Usage

```html
<!-- Mobile first: base styles apply to all sizes -->
<div class="text-sm md:text-base lg:text-lg">
  Responsive text
</div>

<!-- Hidden on mobile, visible on desktop -->
<div class="hidden md:block">
  Desktop only
</div>

<!-- Visible on mobile, hidden on desktop -->
<div class="block md:hidden">
  Mobile only
</div>

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  ...
</div>

<!-- Responsive padding -->
<div class="p-4 md:p-6 lg:p-8">
  ...
</div>
```

---

## 🌙 Dark Mode

### Setup

Enable dark mode in `tailwind.config.js`:
```javascript
module.exports = {
  darkMode: 'class', // or 'media'
  // ...
}
```

### Usage

```html
<!-- Light mode: white bg, dark mode: gray-800 bg -->
<div class="bg-white dark:bg-gray-800">
  <!-- Light mode: black text, dark mode: white text -->
  <p class="text-black dark:text-white">
    Content
  </p>
</div>
```

**Toggle dark mode**:
```typescript
// Add 'dark' class to <html> element
document.documentElement.classList.add('dark');

// Remove 'dark' class
document.documentElement.classList.remove('dark');
```

---

## 📋 Common Patterns for Vaughan-Tauri

### Pattern 1: Card Component

```html
<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
  <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
    Card Title
  </h2>
  <p class="text-gray-600 dark:text-gray-300">
    Card content
  </p>
</div>
```

---

### Pattern 2: Button

```html
<!-- Primary Button -->
<button class="
  bg-blue-500 hover:bg-blue-600 active:bg-blue-700
  text-white font-medium
  px-4 py-2 rounded-lg
  transition-colors duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Send Transaction
</button>

<!-- Secondary Button -->
<button class="
  bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600
  text-gray-900 dark:text-white font-medium
  px-4 py-2 rounded-lg
  transition-colors duration-200
">
  Cancel
</button>
```

---

### Pattern 3: Input Field

```html
<div class="space-y-2">
  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
    Recipient Address
  </label>
  <input
    type="text"
    class="
      w-full px-4 py-2 rounded-lg
      border border-gray-300 dark:border-gray-600
      bg-white dark:bg-gray-800
      text-gray-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-blue-500
      placeholder-gray-400 dark:placeholder-gray-500
    "
    placeholder="0x..."
  />
</div>
```

---

### Pattern 4: Balance Display

```html
<div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
  <div>
    <p class="text-sm text-gray-500 dark:text-gray-400">Balance</p>
    <p class="text-2xl font-bold text-gray-900 dark:text-white">
      10.5 ETH
    </p>
  </div>
  <div class="text-right">
    <p class="text-sm text-gray-500 dark:text-gray-400">USD Value</p>
    <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">
      $21,000.00
    </p>
  </div>
</div>
```

---

### Pattern 5: Network Selector

```html
<select class="
  w-full px-4 py-2 rounded-lg
  border border-gray-300 dark:border-gray-600
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  focus:outline-none focus:ring-2 focus:ring-blue-500
  cursor-pointer
">
  <option>Ethereum Mainnet</option>
  <option>Polygon</option>
  <option>Arbitrum</option>
</select>
```

---

### Pattern 6: Transaction List Item

```html
<div class="
  flex items-center justify-between p-4
  border-b border-gray-200 dark:border-gray-700
  hover:bg-gray-50 dark:hover:bg-gray-800
  transition-colors duration-150
  cursor-pointer
">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
      <span class="text-blue-600 dark:text-blue-300">↑</span>
    </div>
    <div>
      <p class="font-medium text-gray-900 dark:text-white">Sent</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">0x742d...0bEb</p>
    </div>
  </div>
  <div class="text-right">
    <p class="font-semibold text-gray-900 dark:text-white">-1.5 ETH</p>
    <p class="text-sm text-gray-500 dark:text-gray-400">2 hours ago</p>
  </div>
</div>
```

---

## 🎨 Arbitrary Values

When you need a custom value:

```html
<!-- Custom color -->
<div class="bg-[#316ff6]">...</div>

<!-- Custom size -->
<div class="w-[137px]">...</div>

<!-- Custom spacing -->
<div class="mt-[17px]">...</div>

<!-- With calc() -->
<div class="h-[calc(100vh-64px)]">...</div>
```

---

## ⚠️ Common Mistakes

### ❌ DON'T: Concatenate class names
```typescript
// Wrong - Tailwind won't detect these
const size = 'lg';
<div className={`text-${size}`}>...</div>
```

### ✅ DO: Use complete class names
```typescript
// Correct
const sizeClass = size === 'lg' ? 'text-lg' : 'text-base';
<div className={sizeClass}>...</div>
```

---

## 📚 Additional Resources

- **Official Docs**: https://tailwindcss.com/docs
- **Cheat Sheet**: https://nerdcave.com/tailwind-cheat-sheet
- **Playground**: https://play.tailwindcss.com/

---

**Remember**: Tailwind is mobile-first! Base styles apply to all sizes, then use breakpoints to override for larger screens.
