/* Ready-to-run C++ programs for the OOP lessons (used by compiler.html). Every program is tested with g++ -std=c++17. */
window.SW_OOP_PROGRAMS = [
 {
  "id": "start-hello",
  "group": "Shuru karo",
  "title": "Hello: naam pucho (cin)",
  "stdin": "Ali",
  "code": "// Pehla program: naam pucho aur salam karo\n// Neeche \"Input\" box me apna naam likho, phir Run dabao.\n#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string naam;\n    cout << \"Apna naam likho: \";\n    if (!(cin >> naam)) naam = \"Student\";\n    cout << \"\\nAssalam-o-Alaikum, \" << naam << \"!\" << endl;\n    cout << \"Start Well Education me C++ seekhne ka shukriya.\" << endl;\n    return 0;\n}\n"
 },
 {
  "id": "aasan-class",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 1: Class aur Object",
  "code": "// Chapter 1: Class aur Object\n// Class = Naqsha. Object = us naqshe se bani asli cheez.\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Player {            // CLASS - Naqsha\npublic:\n    string naam;\n    int runs = 0;\n\n    void batting() {\n        runs += 4;\n        cout << naam << \" batting kar raha hai. Runs: \" << runs << endl;\n    }\n};\n\nint main() {\n    Player babar;          // OBJECT 1 - Asli player\n    babar.naam = \"Babar\";\n\n    Player rizwan;         // OBJECT 2\n    rizwan.naam = \"Rizwan\";\n\n    babar.batting();\n    babar.batting();\n    rizwan.batting();\n\n    cout << \"1 class (Player) se 2 objects bane.\" << endl;\n    return 0;\n}\n"
 },
 {
  "id": "aasan-data",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 2: Data aur Function",
  "code": "// Chapter 2: Data aur Function\n// OOP me data (saman) aur function (kaam) ek hi dabbe (class) me hote hain.\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Order {\npublic:\n    string customer = \"Ali\";     // Data\n    int price = 2500;            // Data\n    int quantity = 2;            // Data\n\n    void billBanao() {           // Function\n        cout << \"Bill ban gaya: \" << price * quantity << endl;\n    }\n    void paymentLo()   { cout << \"Payment le li\" << endl; }\n    void parcelBhejo() { cout << \"Parcel chala gaya\" << endl; }\n};\n\nint main() {\n    Order o;\n    cout << \"Customer: \" << o.customer << \", Price: \" << o.price\n         << \", Quantity: \" << o.quantity << endl;\n    o.billBanao();\n    o.paymentLo();\n    o.parcelBhejo();\n    return 0;\n}\n"
 },
 {
  "id": "aasan-enc",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 3: Encapsulation",
  "code": "// Chapter 3: Encapsulation\n// private = tala laga diya. public = darwaza khula hai.\n#include <iostream>\nusing namespace std;\n\nclass Order {\nprivate:               // Band - bahar wala nahi dekh sakta\n    int price = 2500;\n\npublic:                // Khula - bahar wala use kar sakta hai\n    void billBanao() {\n        cout << \"Bill = \" << price * 2 << endl;\n    }\n};\n\nint main() {\n    Order order;\n    order.billBanao();          // Theek hai: public function\n\n    // Neeche wali line se // hata kar Run karo - error aayega:\n    // cout << order.price;     // Error: price private hai\n\n    return 0;\n}\n"
 },
 {
  "id": "aasan-inh",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 4: Inheritance",
  "code": "// Chapter 4: Inheritance\n// Baap ne likh diya, beta dobara nahi likhega.\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Player {                         // Baap\npublic:\n    string naam;\n    void batting() { cout << naam << \": Batting\" << endl; }\n};\n\nclass Batsman : public Player {        // Beta - baap ka sab le liya\npublic:\n    void sixMaro() { cout << naam << \": Six!\" << endl; }\n};\n\nclass Bowler : public Player {         // Doosra beta\npublic:\n    void wicketLo() { cout << naam << \": Wicket!\" << endl; }\n};\n\nint main() {\n    Batsman b; b.naam = \"Babar\";\n    b.batting();      // baap se mila\n    b.sixMaro();      // apna\n\n    Bowler s; s.naam = \"Shaheen\";\n    s.batting();      // baap se mila\n    s.wicketLo();     // apna\n    return 0;\n}\n"
 },
 {
  "id": "aasan-poly",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 5: Polymorphism",
  "code": "// Chapter 5: Polymorphism\n// Naam ek (khelo / paymentKaro), kaam alag alag.\n#include <iostream>\nusing namespace std;\n\nclass Player {\npublic:\n    virtual void khelo() { cout << \"Khel raha hai\" << endl; }\n    virtual ~Player() {}\n};\nclass Batsman : public Player { public: void khelo() override { cout << \"Batsman: Batting kar raha hai\" << endl; } };\nclass Bowler  : public Player { public: void khelo() override { cout << \"Bowler: Bowling kar raha hai\" << endl; } };\nclass Keeper  : public Player { public: void khelo() override { cout << \"Keeper: Keeping kar raha hai\" << endl; } };\n\nclass Payment {\npublic:\n    virtual void paymentKaro() = 0;\n    virtual ~Payment() {}\n};\nclass COD      : public Payment { public: void paymentKaro() override { cout << \"COD: Cash do\" << endl; } };\nclass JazzCash : public Payment { public: void paymentKaro() override { cout << \"JazzCash: Mobile se bhejo\" << endl; } };\nclass Bank     : public Payment { public: void paymentKaro() override { cout << \"Bank: Card se karo\" << endl; } };\n\nint main() {\n    Batsman a; Bowler b; Keeper c;\n    Player* team[] = { &a, &b, &c };\n    for (Player* p : team) p->khelo();      // ek hi naam, alag kaam\n\n    COD x; JazzCash y; Bank z;\n    Payment* options[] = { &x, &y, &z };\n    for (Payment* p : options) p->paymentKaro();\n    return 0;\n}\n"
 },
 {
  "id": "aasan-abs",
  "group": "OOP Bilkul Aasan",
  "title": "Chapter 6: Abstraction",
  "code": "// Chapter 6: Abstraction\n// Customer ko sirf \"Order Karo\" dikhta hai. Andar ka kaam chhupa hai.\n#include <iostream>\nusing namespace std;\n\nclass Order {\npublic:\n    void orderKaro() {          // Bahar ko sirf ye dikhta hai\n        billBanao();\n        paymentLo();\n        parcelBhejo();\n        cout << \"Order ho gaya!\" << endl;\n    }\nprivate:\n    void billBanao()   { cout << \"(andar) Bill ban raha hai...\" << endl; }\n    void paymentLo()   { cout << \"(andar) Payment li ja rahi hai...\" << endl; }\n    void parcelBhejo() { cout << \"(andar) Parcel bheja ja raha hai...\" << endl; }\n};\n\nint main() {\n    Order o;\n    o.orderKaro();              // Customer bas ye button dabata hai\n    // o.billBanao();           // Error: private - customer ko nahi dikhta\n    return 0;\n}\n"
 },
 {
  "id": "lec1",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 1: Introduction aur Objects",
  "code": "// Lecture 1: Introduction aur Objects\n// Object = state (data) + behavior (functions)\n#include <iostream>\nusing namespace std;\n\nclass Account {\n    double balance;\npublic:\n    Account(double start) { balance = start; }\n    void deposit(double x) { balance += x; }\n    double getBalance() { return balance; }\n};\n\nint main() {\n    Account acc(5000);                 // Account bana: balance = 5000\n    cout << \"Shuru ka balance: \" << acc.getBalance() << endl;\n    acc.deposit(500);                  // deposit(500) chala\n    cout << \"deposit(500) ke baad: \" << acc.getBalance() << endl;   // 5500\n    return 0;\n}\n"
 },
 {
  "id": "lec2",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 2: Encapsulation aur Interface",
  "code": "// Lecture 2: Encapsulation aur Interface\n// ATM: aap sirf buttons dabate ho, andar ka cash nahi dekhte.\n#include <iostream>\nusing namespace std;\n\nclass Atm {\n    int cash = 100000;   // private\npublic:\n    bool withdraw(int x) {\n        if (x <= cash) { cash -= x; return true; }\n        return false;\n    }\n};\n\nint main() {\n    Atm atm;\n    cout << boolalpha;\n    cout << \"withdraw(5000) = \" << atm.withdraw(5000) << endl;       // true\n    cout << \"withdraw(200000) = \" << atm.withdraw(200000) << endl;   // false: itna cash nahi\n    // cout << atm.cash;   // Error: private - bahar se nahi dekh sakte\n    return 0;\n}\n"
 },
 {
  "id": "lec3",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 3: Abstraction, Class, Inheritance",
  "code": "// Lecture 3: Abstraction, Class, Inheritance\n#include <iostream>\nusing namespace std;\n\nclass Vehicle {\npublic:\n    void start() { cout << \"Vehicle start ho gayi\" << endl; }\n};\n\nclass Car : public Vehicle {\npublic:\n    void ac() { cout << \"Car ka AC on\" << endl; }\n};\n\nint main() {\n    Car c;\n    c.start();   // Vehicle se mufat me mila\n    c.ac();      // Car ka apna\n    return 0;\n}\n"
 },
 {
  "id": "lec4",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 4: Inheritance ke Concepts",
  "code": "// Lecture 4: Inheritance ke Concepts - abstract class\n#include <iostream>\nusing namespace std;\n\nclass Shape {\npublic:\n    virtual void draw() = 0;     // pure virtual: Shape abstract hai\n    virtual ~Shape() {}\n};\n\nclass Circle : public Shape {\npublic:\n    void draw() override { cout << \"O\" << endl; }\n};\n\nclass Square : public Shape {\npublic:\n    void draw() override { cout << \"[]\" << endl; }\n};\n\nint main() {\n    // Shape s;      // Error: abstract class ka object nahi banta\n    Circle c;\n    c.draw();        // O\n    Square q;\n    q.draw();        // []\n    return 0;\n}\n"
 },
 {
  "id": "lec5",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 5: Association, Composition, Aggregation",
  "code": "// Lecture 5: Association, Composition, Aggregation\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Engine {\npublic:\n    Engine()  { cout << \"Engine bana\" << endl; }\n    ~Engine() { cout << \"Engine khatam\" << endl; }\n};\n\nclass Car {                 // Composition: Car ke andar Engine\n    Engine e;\npublic:\n    Car()  { cout << \"Car bani\" << endl; }\n    ~Car() { cout << \"Car khatam\" << endl; }\n};\n\nclass Player {\npublic:\n    string naam;\n    Player(string n) : naam(n) {}\n};\n\nclass Team {                // Aggregation: Team sirf Player ki taraf ishara karti hai\n    Player* p;\npublic:\n    Team(Player* x) : p(x) { cout << \"Team me shamil: \" << p->naam << endl; }\n    ~Team() { cout << \"Team khatam (player zinda hai)\" << endl; }\n};\n\nint main() {\n    {\n        Car c;              // block khatam = Car aur Engine dono khatam\n    }\n    cout << \"---\" << endl;\n    Player babar(\"Babar\");\n    {\n        Team t(&babar);     // block khatam = sirf Team khatam\n    }\n    cout << babar.naam << \" abhi bhi zinda hai\" << endl;\n    return 0;\n}\n"
 },
 {
  "id": "lec6",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 6: Polymorphism",
  "code": "// Lecture 6: Polymorphism - Payment system\n#include <iostream>\nusing namespace std;\n\nclass Payment {\npublic:\n    virtual void pay(int amount) = 0;\n    virtual ~Payment() {}\n};\nclass COD : public Payment {\npublic: void pay(int a) override { cout << \"COD: \" << a << \" rupay cash lo\" << endl; }\n};\nclass JazzCash : public Payment {\npublic: void pay(int a) override { cout << \"JazzCash: \" << a << \" rupay mobile account se\" << endl; }\n};\nclass Card : public Payment {\npublic: void pay(int a) override { cout << \"Card: \" << a << \" rupay card se charge\" << endl; }\n};\n\nvoid checkout(Payment* p, int amount) {   // checkout ka code ek hi\n    p->pay(amount);\n}\n\nint main() {\n    COD cod; JazzCash jc; Card card;\n    checkout(&cod, 2500);\n    checkout(&jc, 2500);\n    checkout(&card, 2500);\n    return 0;\n}\n"
 },
 {
  "id": "lec7",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 7: C++ me Class",
  "code": "// Lecture 7: C++ me Class\n// class me default private; struct me default public\n#include <iostream>\nusing namespace std;\n\nclass Player {\n    int health = 100;   // private (default)\npublic:\n    void hit() { health -= 10; }\n    int getHealth() { return health; }\n};\n\nint main() {\n    Player p;\n    p.hit();\n    cout << \"p.hit() ke baad health = \" << p.getHealth() << endl;   // 90\n    // cout << p.health;   // Error: private\n    return 0;\n}\n"
 },
 {
  "id": "lec8",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 8: Constructor",
  "code": "// Lecture 8: Constructor\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Student {\n    string name; int age;\npublic:\n    Student() : name(\"NA\"), age(0) {}                     // default\n    Student(string n, int a) : name(n), age(a) {}         // parameterized\n    void show() { cout << name << \", \" << age << endl; }\n};\n\nint main() {\n    Student s1;              // NA, 0\n    Student s2(\"Ali\", 20);   // Ali, 20\n    s1.show();\n    s2.show();\n    return 0;\n}\n"
 },
 {
  "id": "lec9",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 9: Copy Constructor, Destructor, this",
  "code": "// Lecture 9: Copy Constructor, Destructor (deep copy)\n#include <iostream>\nusing namespace std;\n\nclass Buf {\n    int n; int* p;\npublic:\n    Buf(int size) : n(size), p(new int[size]) {\n        for (int i = 0; i < n; i++) p[i] = i + 1;\n    }\n    Buf(const Buf& o) {                    // deep copy\n        n = o.n; p = new int[n];\n        for (int i = 0; i < n; i++) p[i] = o.p[i];\n        cout << \"Deep copy bani (alag memory)\" << endl;\n    }\n    ~Buf() { delete[] p; }\n    void set(int i, int v) { p[i] = v; }\n    void show(const char* label) {\n        cout << label << \": \";\n        for (int i = 0; i < n; i++) cout << p[i] << \" \";\n        cout << endl;\n    }\n};\n\nint main() {\n    Buf b1(3);\n    Buf b2 = b1;          // copy constructor chala\n    b1.set(0, 99);        // b1 badla, b2 par asar nahi\n    b1.show(\"b1\");\n    b2.show(\"b2\");\n    return 0;             // dono apni memory khud delete karte hain - crash nahi\n}\n"
 },
 {
  "id": "lec10",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 10: this Pointer aur const Functions",
  "code": "// Lecture 10: this Pointer aur const Functions\n#include <iostream>\nusing namespace std;\n\nclass Acc {\n    double b = 0;\npublic:\n    double get() const { return b; }                 // read only\n    Acc& add(double x) { b += x; return *this; }     // *this lauta kar chain\n};\n\nint main() {\n    Acc a;\n    a.add(100).add(50);                               // chain chali\n    cout << \"balance = \" << a.get() << endl;          // 150\n    return 0;\n}\n"
 },
 {
  "id": "lec11",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 11: const, Initializer List, static",
  "code": "// Lecture 11: const, Initializer List, static\n#include <iostream>\nusing namespace std;\n\nclass User {\n    static int count;          // poori class ki sirf ek copy\npublic:\n    User() { count++; }\n    static int total() { return count; }\n};\nint User::count = 0;\n\nint main() {\n    User a, b, c;              // 3 User bane\n    cout << \"User::total() = \" << User::total() << endl;   // 3\n    return 0;\n}\n"
 },
 {
  "id": "lec12",
  "group": "OOP Interactive Lectures",
  "title": "Lecture 12: static Functions aur Array of Objects",
  "code": "// Lecture 12: static Functions aur Array of Objects\n#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Student {\n    string name;\n    static int made;\npublic:\n    Student() : name(\"Student \" + to_string(++made)) {\n        cout << \"Default constructor chala (\" << made << \")\" << endl;\n    }\n    void show() { cout << name << endl; }\n    static int howMany() { return made; }   // static: is me 'this' nahi hota\n};\nint Student::made = 0;\n\nint main() {\n    Student s[3];                   // 3 objects\n    for (int i = 0; i < 3; i++)\n        s[i].show();\n    cout << \"Total: \" << Student::howMany() << endl;\n    return 0;\n}\n"
 }
];
