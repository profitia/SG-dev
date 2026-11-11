"""Unprivileged Linux restrictions inherited by parser descendants.

No service secrets, no network (seccomp), no reads outside system runtime and
this job directory, no writes outside this job (Landlock ABI>=3). Fail closed
when the kernel cannot enforce isolation. Does not require CAP_SYS_ADMIN.
"""
import ctypes, errno, os, platform, resource, struct

def isolate(job_dir):
    if platform.system() != 'Linux':
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    libc = ctypes.CDLL(None, use_errno=True)
    machine = platform.machine()
    if machine == 'x86_64':
        arch, blocked = 0xc000003e, [41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,101,165,166,272,298,308,310,311,321,323,435]
    elif machine == 'aarch64':
        arch, blocked = 0xc00000b7, [198,199,200,201,202,203,204,205,206,207,208,209,210,211,117,40,39,97,241,268,270,271,280,282,435]
    else:
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    if libc.prctl(38, 1, 0, 0, 0) != 0:
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    # Landlock syscalls are the same on supported 64-bit architectures.
    abi = libc.syscall(444, 0, 0, 1)
    if abi < 3:
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    handled = (1 << 15) - 1  # through TRUNCATE, all rights supported by ABI3
    ruleset_attr = ctypes.create_string_buffer(struct.pack('Q', handled))
    ruleset = libc.syscall(444, ruleset_attr, 8, 0)
    if ruleset < 0:
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    read = (1 << 0) | (1 << 2) | (1 << 3)  # execute, read file/directory
    try:
        for path, access in [(job_dir, handled), ('/usr', read), ('/lib', read), ('/lib64', read),
                             ('/opt', read), ('/etc/fonts', read), ('/etc/ld.so.cache', 1 << 2),
                             ('/dev/null', (1 << 1) | (1 << 2)), ('/dev/urandom', 1 << 2)]:
            if not os.path.exists(path):
                continue
            fd = os.open(path, os.O_PATH | os.O_CLOEXEC)
            try:
                attr = ctypes.create_string_buffer(struct.pack('Qi', access, fd))
                if libc.syscall(445, ruleset, 1, attr, 0) != 0:
                    raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
            finally:
                os.close(fd)
        if libc.syscall(446, ruleset, 0) != 0:
            raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    finally:
        os.close(ruleset)
    class Filter(ctypes.Structure):
        _fields_ = [('code',ctypes.c_ushort),('jt',ctypes.c_ubyte),('jf',ctypes.c_ubyte),('k',ctypes.c_uint)]
    class Program(ctypes.Structure):
        _fields_ = [('length',ctypes.c_ushort),('filters',ctypes.POINTER(Filter))]
    # Architecture check also rejects x32 syscalls, which could bypass a list.
    instructions = [(0x20,0,0,4),(0x15,1,0,arch),(0x06,0,0,0x80000000),(0x20,0,0,0),
                    (0x35,0,1,0x40000000),(0x06,0,0,0x80000000)]
    for call in blocked:
        instructions.extend([(0x15,0,1,call),(0x06,0,0,0x00050000 | (errno.ENOSYS if call == 435 else errno.EPERM))])
    instructions.append((0x06,0,0,0x7fff0000))
    filters = (Filter * len(instructions))(*(Filter(*x) for x in instructions))
    program = Program(len(instructions), filters)
    if libc.prctl(22, 2, ctypes.byref(program), 0, 0) != 0:
        raise RuntimeError('PARSER_ISOLATION_UNAVAILABLE')
    resource.setrlimit(resource.RLIMIT_CPU, (90, 90))
    resource.setrlimit(resource.RLIMIT_AS, (1536*1024*1024,1536*1024*1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (128*1024*1024,128*1024*1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128,128))
    resource.setrlimit(resource.RLIMIT_CORE, (0,0))
