import {defineConfig} from '@playwright/test';
const live=process.env.PCI_BASE_URL;
// Use the same fractional glyph positioning for the native source font and the
// bundled font. Headless-shell's Linux default otherwise rounds glyph advances.
// This is a browser launch setting for both pages, never a source/CSS adjustment.
export default defineConfig({testDir:'test',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:live??'http://127.0.0.1:3672',browserName:'chromium',channel:process.env.CI?'chromium':'chrome',launchOptions:{args:['--font-render-hinting=none']},trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:live?undefined:{command:'npm start',url:'http://127.0.0.1:3672/v3',reuseExistingServer:false,env:{PORT:'3672'}},timeout:30000});
