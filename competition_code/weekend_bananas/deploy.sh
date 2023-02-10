#!/bin/bash
npm install typescript
cd lib
npm i
npm run build
cd ..
npm i
npm run link
npm run build
