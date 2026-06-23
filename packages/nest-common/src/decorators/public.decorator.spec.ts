import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe('Public Decorator', () => {
  it('debería ser una función', () => {
    expect(typeof Public).toBe('function');
  });

  it('debería funcionar con la constante IS_PUBLIC_KEY exportada', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('debería funcionar cuando se aplica a una clase', () => {
    @Public()
    class TestClass {}

    const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass);
    expect(metadata).toBe(true);
  });

  it('debería funcionar múltiples veces en diferentes clases', () => {
    @Public()
    class TestClass1 {}

    @Public()
    class TestClass2 {}

    const metadata1 = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass1);
    const metadata2 = Reflect.getMetadata(IS_PUBLIC_KEY, TestClass2);

    expect(metadata1).toBe(true);
    expect(metadata2).toBe(true);
  });
});