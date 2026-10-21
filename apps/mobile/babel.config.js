// babel-preset-expo as usual; web dev builds also mark every styled element with where its style lives, so the
// designer's Tweak page can open the right values on click (scripts/tweak).
module.exports = function (api) {
  const tweak = api.caller((c) => !!c && c.platform === 'web' && c.isDev);
  return {
    presets: ['babel-preset-expo'],
    plugins: tweak ? [require('./scripts/tweak/babel-plugin.cjs')] : [],
  };
};
