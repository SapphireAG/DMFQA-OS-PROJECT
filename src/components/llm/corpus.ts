/** Fixed lorem-style corpus for the simulated chat output. Not model output. */
const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore ' +
  'magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo ' +
  'consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur ' +
  'excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum ' +
  'curabitur pretium tincidunt lacus nulla gravida orci a odio nullam varius turpis et commodo pharetra est eros ' +
  'bibendum elit nec luctus magna felis sollicitudin mauris integer in mauris eu nibh euismod gravida duis ac tellus ' +
  'et risus vulputate vehicula donec lobortis risus a elit etiam tempor ut ullamcorper ligula eu tempor congue eros ' +
  'est euismod turpis id tincidunt sapien risus a quam maecenas fermentum consequat mi donec fermentum pellentesque ' +
  'malesuada nulla a mi duis sapien sem aliquet nec commodo eget consequat quis neque aliquam faucibus elit ut dictum'
).split(' ');

export function simulatedText(seed: number, tokens: number, tail = 70): string {
  const start = Math.max(0, tokens - tail);
  const out: string[] = [];
  for (let i = start; i < tokens; i++) {
    let w = WORDS[(seed * 7 + i) % WORDS.length];
    if (i === 0 || (seed + i) % 13 === 0) w = w[0].toUpperCase() + w.slice(1);
    out.push((seed + i) % 13 === 12 ? `${w}.` : w);
  }
  return (start > 0 ? '… ' : '') + out.join(' ');
}
