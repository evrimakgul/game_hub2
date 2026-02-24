export class UserRepository {
  constructor(data) {
    this.data = data;
  }

  findById(userId) {
    return this.data.users.find((entry) => entry.id === userId);
  }

  createUserMap() {
    return new Map(this.data.users.map((entry) => [entry.id, entry]));
  }
}
