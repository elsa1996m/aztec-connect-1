#include "./sha256.hpp"

#include <array>
#include <memory.h>

namespace sha256 {
namespace internal {
constexpr uint32_t init_constants[8]{ 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                                      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 };

constexpr uint32_t round_constants[64]{
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};


bool isLittleEndian()
{
    constexpr int num = 42;
    return (*(char*)&num == 42);
}
} // namespace internal

void prepare_constants(std::array<uint32_t, 8>& input)
{
    input[0] = internal::init_constants[0];
    input[1] = internal::init_constants[1];
    input[2] = internal::init_constants[2];
    input[3] = internal::init_constants[3];
    input[4] = internal::init_constants[4];
    input[5] = internal::init_constants[5];
    input[6] = internal::init_constants[6];
    input[7] = internal::init_constants[7];
}

std::array<uint32_t, 8> sha256_block(const std::array<uint32_t, 8>& h_init,
                                             const std::array<uint32_t, 16>& input)
{
    std::array<uint32_t, 64> w;

    /**
     * Fill first 16 words with the message schedule
     **/
    for (size_t i = 0; i < 16; ++i) {
        w[i] = input[i];
    }

    /**
     * Extend the input data into the remaining 48 words
     **/
    for (size_t i = 16; i < 64; ++i) {
        uint32_t s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >> 3);
        uint32_t s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16] + w[i - 7] + s0 + s1;
    }

    /**
     * Initialize round variables with previous block output
     **/
    uint32_t a = h_init[0];
    uint32_t b = h_init[1];
    uint32_t c = h_init[2];
    uint32_t d = h_init[3];
    uint32_t e = h_init[4];
    uint32_t f = h_init[5];
    uint32_t g = h_init[6];
    uint32_t h = h_init[7];

    /**
     * Apply SHA-256 compression function to the message schedule
     **/
    for (size_t i = 0; i < 64; ++i) {
        uint32_t S1 = ror(e, 6U) ^ ror(e, 11U) ^ ror(e, 25U);
        uint32_t ch = (e & f) ^ (~e & g); // === (e & f) ^ (~e & g), `+` op is cheaper
        uint32_t temp1 = h + S1 + ch + internal::round_constants[i] + w[i];
        uint32_t S0 = ror(a, 2U) ^ ror(a, 13U) ^ ror(a, 22U);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c); // (a & (b + c - (T0 * 2))) + T0; // === (a & b) ^ (a & c) ^ (b & c)
        uint32_t temp2 = S0 + maj;

        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
    }

    /**
     * Add into previous block output and return
     **/
    std::array<uint32_t, 8> output;
    output[0] = a + h_init[0];
    output[1] = b + h_init[1];
    output[2] = c + h_init[2];
    output[3] = d + h_init[3];
    output[4] = e + h_init[4];
    output[5] = f + h_init[5];
    output[6] = g + h_init[6];
    output[7] = h + h_init[7];
    return output;
}


std::vector<uint8_t> sha256(const std::vector<uint8_t>& input)
{
    std::vector<uint8_t> message_schedule;

    std::copy(input.begin(), input.end(), std::back_inserter(message_schedule));
    uint64_t l = message_schedule.size() * 8;
    message_schedule.push_back(0x80);

    uint32_t num_zero_bytes = ((448U - (message_schedule.size() << 3U)) & 511U) >> 3U;

    for (size_t i = 0; i < num_zero_bytes; ++i)
    {
        message_schedule.push_back(0x00);
    }
    for (size_t i = 0; i < 8; ++i)
    {
        uint8_t byte = static_cast<uint8_t>(l >> (uint64_t)(56 - (i * 8)));
        message_schedule.push_back(byte);
    }

    std::array<uint32_t, 8> rolling_hash;
    prepare_constants(rolling_hash);

    const size_t num_blocks = message_schedule.size() / 64;
    for (size_t i = 0; i < num_blocks; ++i) {
        std::array<uint32_t, 16> hash_input;
        memcpy((void*)&hash_input[0], (void*)&message_schedule[i * 64], 64);
        if (internal::isLittleEndian())
        {
            for (size_t j = 0; j < hash_input.size(); ++j)
            {
                hash_input[j] = __builtin_bswap32(hash_input[j]);
            }
        }
        rolling_hash = sha256_block(rolling_hash, hash_input);
    }


    std::vector<uint8_t> output(32);
    memcpy((void*)&output[0], (void*)&rolling_hash[0], 32);
    if (internal::isLittleEndian())
    {
        uint32_t* output_uint32 = (uint32_t*)&output[0];
        for (size_t j = 0; j < 8; ++j)
        {
            output_uint32[j] = __builtin_bswap32(output_uint32[j]);
        }
    }
    return output;
}
}

/*
# Lagrange-base SRS  

Our current reference string is in monomial form, having one in lagrange-base form would singificantly improve prover times. 

In Barretenberg, our current reference string is interacted with via the `io` class.  

The SRS is contained in `srs_db/transcript.dat`. It is stored in a raw binary format, with group elements packed into adjacent 64 byte chunks.  

The transcript.dat file contains a 'manifest' object at the start of the file, which contains basic details like the SRS size.  

The first task would be to use this SRS to produce one in Lagrange-base form, using our polynomial arithmetic and elliptic curve arithmetic libraries.  

The first milestone would be to generate a small in-memory Lagrange-base SRS from a monomial SRS, and to validate this via a unit test. 

Once the core algorithm is working, the second task would be to create a function that will take a `transcript.dat` file, produce a lagrange-base form,  
and write it out as `transcript_lagrange_base.dat` or similar.  

The second milsestone would be to write passing tests that validate the correctness of this new file.  

Once we have `transcript_lagrange_base.dat`, we can integrate it into our prover algorithm. We have a helper class, `ReferenceString`, in `waffle/reference_string.hpp`,  
that we use to pre-fetch our SRS and perform some precomputations on it for our Pippenger algorithm.  

It currently has a container, `monomials`, that stores our monomial-form SRS. We would need a second container, 
`lagrange_base`, that contains the lagrange-base variant.  

Note that, until we also have produced a variant of the SRS in coset lagrange base form, we cannot remove the monomial basis SRS.  

In the constructor of `ReferenceString`, we need a method that loads up the lagrange-base SRS and writes it into the newly created `lagrange_base` container.  

The third milestone would be to validate the correctness of this via passing unit tests.  

The final task would be to use the lagrange-base SRS in `prover.tcc`, when computing all of our commitments except the quotient polynomial.  

### coset-lagrange-base  

TODO. This seems non-trivial due to the fact that we split T(X) up into 4 sub-commitments. This is easy to do in monomial form,  
but seems harder to do if our SRS is in coset-lagrange-base form.

*/