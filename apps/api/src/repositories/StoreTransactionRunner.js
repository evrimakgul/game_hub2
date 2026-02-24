export class StoreTransactionRunner {
  constructor(store) {
    this.store = store;
  }

  read(reader) {
    const data = this.store.read();
    return reader ? reader(data) : data;
  }

  update(mutator) {
    return this.store.update((data) => mutator(data));
  }
}
