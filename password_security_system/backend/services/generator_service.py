import math
import secrets
import string

from services.strength_service import calculate_strength_label


def generate_password(
    length: int = 16,
    use_upper: bool = True,
    use_lower: bool = True,
    use_digits: bool = True,
    use_symbols: bool = True,
    min_digits: int = 0,
    min_symbols: int = 0,
    prefix: str = "",
    suffix: str = "",
    custom_chars: str = "",
) -> dict:
    """
    Generate a cryptographically secure random password using `secrets` module.
    Supports prefix/suffix, custom character additions, and minimum count guarantees.
    """
    prefix = (prefix or "")[:32]
    suffix = (suffix or "")[:32]
    custom_chars = (custom_chars or "")[:64]

    if length < 4:
        raise ValueError("Password length must be at least 4")
    if length > 256:
        raise ValueError("Password length must be at most 256")

    alphabet = ""
    if use_upper:
        alphabet += string.ascii_uppercase
    if use_lower:
        alphabet += string.ascii_lowercase
    if use_digits:
        alphabet += string.digits
    if use_symbols:
        alphabet += string.punctuation
    if custom_chars:
        # Deduplicate while preserving order
        for ch in custom_chars:
            if ch not in alphabet:
                alphabet += ch

    if not alphabet:
        raise ValueError("At least one character set must be selected")

    # Core length = requested - prefix - suffix
    core_len = max(0, length - len(prefix) - len(suffix))

    # Guarantee 1 char from each active charset so all selected types always appear
    mandatory: list[str] = []
    if use_upper:
        mandatory.append(secrets.choice(string.ascii_uppercase))
    if use_lower:
        mandatory.append(secrets.choice(string.ascii_lowercase))
    if use_digits:
        mandatory.append(secrets.choice(string.digits))
    if use_symbols:
        mandatory.append(secrets.choice(string.punctuation))

    # Additional digits/symbols beyond the 1 already guaranteed
    extra_digits = max(0, min_digits - (1 if use_digits else 0))
    extra_symbols = max(0, min_symbols - (1 if use_symbols else 0))

    # Scale down extras if they would push total mandatory past core_len
    available_extra = max(0, core_len - len(mandatory))
    total_extra = extra_digits + extra_symbols
    if total_extra > available_extra and total_extra > 0:
        scale = available_extra / total_extra
        extra_digits = int(extra_digits * scale)
        extra_symbols = available_extra - extra_digits

    mandatory += [secrets.choice(string.digits) for _ in range(extra_digits)]
    mandatory += [secrets.choice(string.punctuation) for _ in range(extra_symbols)]

    # Edge case: more active charsets than core_len
    mandatory = mandatory[:core_len]

    # Fill remaining with random alphabet chars
    remaining = core_len - len(mandatory)
    random_part = [secrets.choice(alphabet) for _ in range(remaining)]

    # Shuffle mandatory + random together
    core = mandatory + random_part
    # Fisher-Yates via secrets
    for i in range(len(core) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        core[i], core[j] = core[j], core[i]

    password = prefix + "".join(core) + suffix

    # Entropy based on core alphabet (prefix/suffix are fixed so add 0 entropy)
    entropy_bits = core_len * math.log2(len(alphabet)) if len(alphabet) > 1 and core_len > 0 else 0

    label = calculate_strength_label(password)

    return {
        "password": password,
        "entropy_bits": round(entropy_bits, 2),
        "strength_label": label,
    }

    """
    Generate a cryptographically secure random password using `secrets` module
    (not `random`).  Calculates Shannon entropy based on alphabet size.
    """
    if length < 8:
        raise ValueError("Password length must be at least 8")

    alphabet = ""
    if use_upper:
        alphabet += string.ascii_uppercase
    if use_lower:
        alphabet += string.ascii_lowercase
    if use_digits:
        alphabet += string.digits
    if use_symbols:
        alphabet += string.punctuation

    if not alphabet:
        raise ValueError("At least one character set must be selected")

    password = "".join(secrets.choice(alphabet) for _ in range(length))

    # Shannon entropy: H = length × log2(|alphabet|)
    entropy_bits = length * math.log2(len(alphabet))

    label = calculate_strength_label(password)

    return {
        "password": password,
        "entropy_bits": round(entropy_bits, 2),
        "strength_label": label,
    }
