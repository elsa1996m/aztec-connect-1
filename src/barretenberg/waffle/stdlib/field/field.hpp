#pragma once

#include "../../../curves/bn254/fr.hpp"
#include "../common.hpp"

namespace waffle
{
    class StandardComposer;
    class BoolComposer;
    class MiMCComposer;
    class ExtendedComposer;
    class TurboComposer;
}

namespace plonk {
namespace stdlib {

template <typename ComposerContext> class bool_t;

template <typename ComposerContext> class field_t {
  public:
    field_t(ComposerContext* parent_context = nullptr);
    field_t(ComposerContext* parent_context, const barretenberg::fr::field_t& value);
    field_t(const uint64_t value);
    field_t(const witness_t<ComposerContext>& value);
    field_t(const field_t& other);
    field_t(field_t&& other);

    field_t(const bool_t<ComposerContext>& other);
    operator bool_t<ComposerContext>();

    field_t& operator=(const field_t& other);
    field_t& operator=(field_t&& other);

    field_t operator+(const field_t& other) const;
    field_t operator-(const field_t& other) const;
    field_t operator*(const field_t& other) const;
    field_t operator/(const field_t& other) const;

    bool_t<ComposerContext> is_zero();

    field_t normalize();

    barretenberg::fr::field_t get_value() const;

    bool is_constant() const { return witness_index == static_cast<uint32_t>(-1); }

    mutable ComposerContext* context = nullptr;
    mutable barretenberg::fr::field_t additive_constant;
    mutable barretenberg::fr::field_t multiplicative_constant;
    mutable uint32_t witness_index = static_cast<uint32_t>(-1);
};

extern template class field_t<waffle::StandardComposer>;
extern template class field_t<waffle::BoolComposer>;
extern template class field_t<waffle::MiMCComposer>;
extern template class field_t<waffle::ExtendedComposer>;
extern template class field_t<waffle::TurboComposer>;

} // namespace stdlib
} // namespace plonk
