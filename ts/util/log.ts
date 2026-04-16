// ログ出力関連の共通モジュール
// 記述短縮のためのラッパー
export function lg(target: unknown, message: Object = ""): void {
  console.log(message, target);
}

export function lge(target: unknown, message: Object = ""): void {
  console.error(message, target);
}

export function log(target: unknown, message: string = ""): void {
  setTimeout(console.log.bind(console, target + message));
}

// JSON.stringify用
export function lgj(obj: object | null, message: string = ""): void {
  console.log(message + JSON.stringify(obj));
}

export function logj(obj: object | null, message: string = ""): void {
  setTimeout(console.log.bind(console, message + JSON.stringify(obj)));
}

/**
 * 折りたたみ式のログ出力
 * const lga = lgArr(arguments.callee.name);
 * これで関数名が出る
 * lga.push("メソッドの処理内で追記");
 */
export function lgArr(
  calleeName: string,
  icon: string = "🤖 ",
  obj1?: unknown,
  obj2?: unknown,
  obj3?: unknown,
  cache?: { skipStack?: boolean }
): Array<unknown> | undefined {
  if (cache && cache.skipStack) {
    return;
  }
  const arr: Array<unknown> = [icon + calleeName];
  lg(arr);
  const stackRaw = new Error().stack;
  const stack = stackRaw ? stackRaw.split("\n").slice(2) : [];
  arr.push(stack.join("\n"));
  if (obj1 !== undefined) {
    arr.push(obj1);
  }
  if (obj2 !== undefined) {
    arr.push(obj2);
  }
  if (obj3 !== undefined) {
    arr.push(obj3);
  }
  return arr;
}
