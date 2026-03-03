@0x1234567890abcdef;

struct Person {
  name @0 :Text;
  id @1 :UInt32;
  email @2 :Text;
  phones @3 :List(PhoneNumber);
}

struct PhoneNumber {
  number @0 :Text;
  type @1 :Type;
}
