#!/usr/bin/env node
/**/
/// <reference types="node" />

import process from 'node:process';

import { main } from './source/cli.js';

main().catch(() => process.exit(1));
