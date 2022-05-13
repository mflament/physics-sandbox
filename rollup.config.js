import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: ['./src/index.ts'],
    external: ['react', 'react-dom'],
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: false,
      plugins: [terser()]
    },
    plugins: [
      typescript()
    ]
  }
];
