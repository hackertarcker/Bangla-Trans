/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import TranslationApp from './components/TranslationApp';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <>
      <TranslationApp />
      <Toaster position="top-right" />
    </>
  );
}
