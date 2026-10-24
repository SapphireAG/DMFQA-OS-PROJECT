/// <reference lib="webworker" />
import { expose } from 'comlink';
import { api } from './api';

expose(api);
