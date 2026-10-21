// Adds dataSet={{ tw: "<file>|<style keys>|<line>" }} to every JSX element with a style prop (web dev only, see
// babel.config.js). react-native-web renders it as data-tw, which the Tweak picker reads.
const path = require('path');

const REPO = path.resolve(__dirname, '../../../..');

module.exports = function tweakPlugin({ types: t }) {
  return {
    name: 'tweak-source',
    visitor: {
      JSXOpeningElement(p, state) {
        const file = state.file.opts.filename || '';
        if (!file.includes(`${path.sep}src${path.sep}`) || file.includes('node_modules')) return;
        const attrs = p.node.attributes;
        const style = attrs.find((a) => t.isJSXAttribute(a) && a.name.name === 'style');
        if (!style || attrs.some((a) => t.isJSXAttribute(a) && a.name.name === 'dataSet')) return;
        const keys = [];
        p.get('attributes').forEach((ap) => {
          if (ap.node !== style) return;
          ap.traverse({
            MemberExpression(m) {
              if (t.isIdentifier(m.node.object, { name: 'styles' }) && t.isIdentifier(m.node.property) && !keys.includes(m.node.property.name)) keys.push(m.node.property.name);
            },
          });
        });
        const rel = path.relative(REPO, file).split(path.sep).join('/');
        const line = p.node.loc ? p.node.loc.start.line : 0;
        // first, so a {...props} spread after it wins: a wrapper (our Text) passes on its caller's mark instead of its own
        attrs.unshift(
          t.jsxAttribute(
            t.jsxIdentifier('dataSet'),
            t.jsxExpressionContainer(t.objectExpression([t.objectProperty(t.identifier('tw'), t.stringLiteral(`${rel}|${keys.join(',')}|${line}`))])),
          ),
        );
      },
    },
  };
};
