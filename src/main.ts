import './styles/main.css';
import { startApp } from './app';
import { markStep } from './perf';

markStep('script');

void startApp(document.getElementById('app')!);
