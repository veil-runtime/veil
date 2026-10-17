// Linux x86_64 classic BPF. No native addon or shell-generated filter.
// Fail closed on other ABIs, including x32. Threads share the process's
// address-space/CPU limits; independent processes are deliberately unsupported.
export function verificationFilter(): Buffer {
  const instructions: number[][] = [];
  const stmt = (code: number, k: number) => instructions.push([code, 0, 0, k]);
  const jump = (code: number, k: number, yes: number, no: number) =>
    instructions.push([code, yes, no, k]);
  const deny = (nr: number, errno = 1) => {
    jump(0x15, nr, 0, 1);
    stmt(0x06, 0x00050000 | errno);
  };
  stmt(0x20, 4); // seccomp_data.arch
  jump(0x15, 0xc000003e, 1, 0);
  stmt(0x06, 0x80000000); // KILL_PROCESS
  stmt(0x20, 0); // syscall number
  jump(0x35, 0x40000000, 0, 1);
  stmt(0x06, 0x80000000);
  // fork, vfork, namespaces, mount, tracing, kernel interfaces, sockets,
  // anonymous file-backed/IPC allocations that evade RLIMIT_AS.
  for (const nr of [57, 58, 272, 308, 165, 166, 155, 161, 101, 310, 311,
    321, 298, 323, 425, 426, 427, 41, 53, 319, 29, 64, 68,
    248, 249, 250, 169, 175, 176, 246, 320, 428, 429, 430, 431, 432, 442]) deny(nr);
  deny(435, 38); // clone3: ENOSYS permits libc's restricted clone fallback
  jump(0x15, 56, 0, 3); // clone: only CLONE_THREAD
  stmt(0x20, 16); // low word of args[0]
  jump(0x45, 0x10000, 1, 0);
  stmt(0x06, 0x00050001);
  stmt(0x06, 0x7fff0000); // ALLOW
  const result = Buffer.alloc(instructions.length * 8);
  instructions.forEach(([code, jt, jf, k], index) => {
    result.writeUInt16LE(code!, index * 8);
    result[index * 8 + 2] = jt!;
    result[index * 8 + 3] = jf!;
    result.writeUInt32LE(k! >>> 0, index * 8 + 4);
  });
  return result;
}
