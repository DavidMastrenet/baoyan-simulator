export function cleanNickname(value: string): string | null {
  const nickname = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N}_· .-]{2,20}$/u.test(nickname) && /[\p{L}\p{N}]/u.test(nickname)
    ? nickname
    : null;
}
