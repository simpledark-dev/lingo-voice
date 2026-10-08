/** Friendly two-word guest names. Collisions are fine: identity comes from the user id. */
const ADJECTIVES = [
  "Brave", "Calm", "Clever", "Curious", "Gentle", "Bright", "Quiet", "Swift", "Kind", "Lucky",
  "Merry", "Noble", "Patient", "Proud", "Quick", "Sunny", "Warm", "Witty", "Bold", "Cheerful",
  "Eager", "Fair", "Happy", "Jolly", "Keen", "Lively", "Mellow", "Nimble", "Plucky", "Steady",
];
const ANIMALS = [
  "Otter", "Heron", "Fox", "Lynx", "Panda", "Robin", "Koala", "Dolphin", "Falcon", "Gecko",
  "Badger", "Ibis", "Jaguar", "Kiwi", "Lemur", "Marten", "Narwhal", "Osprey", "Puffin", "Quail",
  "Raven", "Seal", "Tapir", "Toucan", "Walrus", "Wren", "Yak", "Zebra", "Finch", "Moose",
];

export function generateGuestName(random: () => number = Math.random): string {
  const a = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)]!;
  const n = ANIMALS[Math.floor(random() * ANIMALS.length)]!;
  return `${a} ${n}`;
}
