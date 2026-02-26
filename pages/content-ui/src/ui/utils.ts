export type ClassValue = string | number | boolean | undefined | null | ClassValue[];
export type ClassArray = ClassValue[];

function toVal(mix: ClassValue): string {
  let str = '';
  let k: number;
  let y: ClassValue;

  if (typeof mix === 'string' || typeof mix === 'number') {
    str += mix;
  } else if (typeof mix === 'object') {
    if (Array.isArray(mix)) {
      for (k = 0; k < mix.length; k++) {
        if (mix[k]) {
          y = toVal(mix[k]);
          if (y) {
            str && (str += ' ');
            str += y;
          }
        }
      }
    } else {
      for (k in mix) {
        if (mix[k]!) {
          str && (str += ' ');
          str += k;
        }
      }
    }
  }

  return str;
}

export function classNames(...args: ClassValue[]): string {
  let i = 0;
  let tmp: ClassValue;
  let x: string;
  let str = '';

  while (i < args.length) {
    tmp = args[i++];
    if (tmp) {
      x = toVal(tmp);
      if (x) {
        str && (str += ' ');
        str += x;
      }
    }
  }

  return str;
}
