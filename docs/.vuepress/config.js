import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'
import { searchPlugin } from '@vuepress/plugin-search'
import { prismjsPlugin } from '@vuepress/plugin-prismjs'

export default defineUserConfig({
  locales: {
    '/': {
      lang: 'en-US',
      title: 'Volga',
      description: 'Easy & Fast Web Framework for Rust',
    },
    '/ru/': {
      lang: 'ru-RU',
      title: 'Волга',
      description: 'Простой и быстрый веб-фреймворк для Rust',
    },
  },
  base: '/volga-docs/',
  theme: defaultTheme({
    contributors: false,
    locales: {
      '/': {
        selectLanguageName: 'English',
        navbar: [
          {
            text: 'Home',
            link: '/',
          },
          {
            text: 'API Docs',
            link: 'https://docs.rs/volga/latest/volga/',
          },
          {
            text: 'GitHub',
            link: 'https://github.com/RomanEmreis/volga',
          },
        ],
        sidebar: [
          {
            text: 'Home',
            link: '/',
          },
          {
            text: 'Basics',
            prefix: '/getting-started/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              `route-groups`,
              'headers',
              'json-payload',
              'form',
              'files',
              'middlewares',
              'di',
              `compression`,
              `decompression`,
              'https',
              `tracing`
            ]
          },
          {
            text: 'Advanced',
            prefix: '/advanced/',
            children: [
              'cancellation',
              'custom-trace-opt-head',
              'http'
            ]
          }
        ]
      },
      '/ru/': {
        selectLanguageName: 'Русский',
        navbar: [
          {
            text: 'Главная',
            link: '/ru/',
          },
          {
            text: 'API Docs',
            link: 'https://docs.rs/volga/latest/volga/',
          },
          {
            text: 'GitHub',
            link: 'https://github.com/RomanEmreis/volga',
          },
        ],
        sidebar: [
          {
            text: 'Главная',
            link: '/ru/',
          },
          {
            text: 'Основы',
            prefix: '/ru/getting-started/',
            children: [
              'quick-start',
              'route-params',
              'query-params',
              `route-groups`,
              'headers',
              'json-payload',
              'form',
              'files',
              'middlewares',
              'di',
              `compression`,
              `decompression`,
              'https',
              `tracing`
            ]
          },
          {
            text: 'Продвинутые сценарии',
            prefix: '/ru/advanced/',
            children: [
              'cancellation',
              'custom-trace-opt-head',
              'http'
            ]
          }
        ]
      }
    },
  }),

  bundler: viteBundler(),

  plugins: [
    searchPlugin({
      maxSuggestions: 10,
    }),
    prismjsPlugin({
      themes: {
        dark: 'one-dark',
        light: 'one-light'
      }
    }) 
  ],
})
