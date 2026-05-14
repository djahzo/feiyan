declare module 'bcryptjs' {
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
}
