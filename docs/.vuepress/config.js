import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'
import { searchPlugin } from '@vuepress/plugin-search'
import { prismjsPlugin } from '@vuepress/plugin-prismjs'

export default defineUserConfig({
  lang: 'en-US',
  title: 'Volga',
  description: 'Easy & Fast Web Framework for Rust',
  base: '/volga-docs/',
  theme: defaultTheme({
    navbar: [
      {
        text: 'Home',
        link: '/',
      },
      {
        text: 'crates.io',
        link: 'https://crates.io/crates/volga',
      },
      {
        text: 'API',
        link: 'https://docs.rs/volga/latest/volga/',
      },
      {
        text: 'GitHub',
        link: 'https://github.com/RomanEmreis/volga',
      },
    ],
    sidebar: [
      '/',
      {
        text: 'Getting Started',
        prefix: '/getting-started/',
        children: [
          'quick-start',
          'route-params',
          'query-params',
          'headers',
          'json-payload',
          'files',
          'middlewares',
        ]
      },
      {
        text: 'Advanced',
        prefix: '/advanced/',
        children: [
          'cancellation',
          'http',
          'mini'
        ]
      }
    ],
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