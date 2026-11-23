package expo.modules.verificationcamera

import java.io.IOException
import java.io.OutputStream

// A fixed-size, wipeable RAM sink. It cannot grow or create a temporary file.
internal class BoundedJpegBuffer(private val limit: Int) : OutputStream() {
  private val bytes = ByteArray(limit)
  var size = 0
    private set
  var overflowed = false
    private set

  override fun write(value: Int) {
    if (size >= limit) overflow()
    bytes[size++] = value.toByte()
  }

  override fun write(source: ByteArray, offset: Int, length: Int) {
    if (offset < 0 || length < 0 || offset > source.size - length) throw IndexOutOfBoundsException()
    if (length > limit - size) overflow()
    source.copyInto(bytes, size, offset, offset + length)
    size += length
  }

  fun <T> useBytes(block: (ByteArray, Int) -> T): T = block(bytes, size)

  private fun overflow(): Nothing {
    overflowed = true
    throw IOException("The in-memory JPEG limit was reached.")
  }

  override fun close() {
    bytes.fill(0)
    size = 0
  }
}
