// Development-only host x86 oracle; never shipped to the browser.
#include <stdint.h>
#include <stdio.h>

// The instructions run natively. Mask to flags defined for ADD, SUB and CMP.
#define RUN8(OP, NAME) do { \
  unsigned long value = a, source = b, flags; \
  __asm__ volatile(OP "b %b2,%b0; pushfq; popq %1" \
    : "+q"(value), "=r"(flags) : "q"(source) : "cc"); \
  printf(NAME " 8 %u %u %lu %lu\n", a, b, value & 255, flags & 0x8d5); \
} while (0)
#define RUN16(OP, NAME) do { \
  unsigned long value = a, source = b, flags; \
  __asm__ volatile(OP "w %w2,%w0; pushfq; popq %1" \
    : "+r"(value), "=r"(flags) : "r"(source) : "cc"); \
  printf(NAME " 16 %u %u %lu %lu\n", a, b, value & 65535, flags & 0x8d5); \
} while (0)

int main(void) {
  uint32_t state = 0x04862026;
  for (unsigned i = 0; i < 8192; i++) {
    state = state * 1664525u + 1013904223u;
    unsigned a = (state >> 8) & 255;
    state = state * 1664525u + 1013904223u;
    unsigned b = (state >> 8) & 255;
    RUN8("add", "add"); RUN8("sub", "sub"); RUN8("cmp", "cmp");
  }
  for (unsigned i = 0; i < 8192; i++) {
    state = state * 1664525u + 1013904223u;
    unsigned a = (state >> 8) & 65535;
    state = state * 1664525u + 1013904223u;
    unsigned b = (state >> 8) & 65535;
    RUN16("add", "add"); RUN16("sub", "sub"); RUN16("cmp", "cmp");
  }
  return 0;
}
