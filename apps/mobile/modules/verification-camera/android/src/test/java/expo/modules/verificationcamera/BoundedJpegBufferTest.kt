package expo.modules.verificationcamera

import java.io.IOException
import org.junit.Assert.*
import org.junit.Test

class BoundedJpegBufferTest {
  @Test fun allowsExactlyTheLimitWithoutGrowing() {
    BoundedJpegBuffer(4).use { buffer ->
      buffer.write(byteArrayOf(1, 2, 3), 0, 3)
      buffer.write(4)
      assertEquals(4, buffer.size)
      assertFalse(buffer.overflowed)
      buffer.useBytes { bytes, count -> assertEquals(4, bytes.size); assertEquals(4, count) }
    }
  }

  @Test fun rejectsOversizedWritesWithoutPartialCopy() {
    BoundedJpegBuffer(4).use { buffer ->
      buffer.write(1)
      try { buffer.write(byteArrayOf(2, 3, 4, 5), 0, 4); fail("Expected the RAM limit") }
      catch (_: IOException) { assertTrue(buffer.overflowed); assertEquals(1, buffer.size) }
    }
  }

  @Test fun rejectsSingleBytePastLimit() {
    BoundedJpegBuffer(1).use { buffer ->
      buffer.write(1)
      try { buffer.write(2); fail("Expected the RAM limit") }
      catch (_: IOException) { assertTrue(buffer.overflowed); assertEquals(1, buffer.size) }
    }
  }

  @Test fun closeWipesTheWholeBufferIncludingAfterFailure() {
    val buffer = BoundedJpegBuffer(4)
    buffer.write(byteArrayOf(1, 2, 3, 4), 0, 4)
    try { buffer.write(5) } catch (_: IOException) { /* expected */ }
    buffer.close()
    assertEquals(0, buffer.size)
    buffer.useBytes { bytes, _ -> assertTrue(bytes.all { it == 0.toByte() }) }
  }

  @Test fun validatesWriteOffsets() {
    BoundedJpegBuffer(4).use { buffer ->
      for (offset in intArrayOf(-1, 5)) {
        try { buffer.write(byteArrayOf(1, 2), offset, 1); fail("Expected invalid offset") }
        catch (_: IndexOutOfBoundsException) { assertEquals(0, buffer.size) }
      }
    }
  }
}
