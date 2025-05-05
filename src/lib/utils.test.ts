import { myFunction } from '../lib/utils';

describe('utils', () => {
  it('should return a truthy value', () => {
    const result = myFunction();
    expect(result).toBeTruthy();
  });
});