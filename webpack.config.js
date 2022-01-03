const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mode = process.env.NODE_ENV || 'development';

module.exports = {
  entry: './index.js',
  devtool: 'source-map',
  target: 'web',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ '@babel/preset-env' ],
            plugins: [ '@babel/plugin-transform-runtime', '@babel/plugin-transform-modules-commonjs' ],
          }
        }
      }
    ]
  },
  resolve: {
      fallback: {
        "fs": false,
        "tls": false,
        "net": false,
        "path": false,
        "zlib": false,
        "http": false,
        "https": false,
        "buffer": require.resolve("buffer/"), // https://www.npmjs.com/package/buffer#usage
        "stream": require.resolve('stream-browserify'),
        "crypto": require.resolve('crypto-browserify'),
        "crypto-browserify": require.resolve('crypto-browserify'), //if you want to use this module also don't forget npm i crypto-browserify 
    },
    modules: [ '../../node_modules' ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{
        from: '../../node_modules/webextension-polyfill/dist/browser-polyfill.js',
      }],}),
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.DefinePlugin({
      ENVIRONMENT: JSON.stringify(mode)
    }),
		new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
  ],
  mode
};
