package app.yaprak;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/backups")
@CrossOrigin(origins={"capacitor://localhost","http://localhost:5173"}, maxAge=3600)
public class Backups {
    private final JdbcTemplate jdbc;
    private final byte[] expectedHeader;

    public Backups(JdbcTemplate jdbc, @Value("${YAPRAK_TOKEN}") String token) {
        if (token.isBlank() || token.length() < 32) throw new IllegalArgumentException("YAPRAK_TOKEN must contain at least 32 characters");
        this.jdbc = jdbc;
        this.expectedHeader = ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
    }

    private void authenticate(String header) {
        if (!MessageDigest.isEqual(expectedHeader, header.getBytes(StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    record Backup(long id, String savedAt) {}

    @GetMapping
    public List<Backup> list(@RequestHeader(value="Authorization",defaultValue="") String header) {
        authenticate(header);
        return jdbc.query("SELECT id, saved_at FROM journal_backups ORDER BY id DESC", (rs, row) ->
                new Backup(rs.getLong("id"), rs.getTimestamp("saved_at").toInstant().toString()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Backup save(@RequestHeader(value="Authorization",defaultValue="") String header,
                       @RequestParam("file") MultipartFile file) throws IOException {
        authenticate(header);
        if (file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return jdbc.queryForObject("INSERT INTO journal_backups(content) VALUES (?) RETURNING id, saved_at",
                (rs, row) -> new Backup(rs.getLong(1), rs.getTimestamp(2).toInstant().toString()), file.getBytes());
    }

    @GetMapping(value="/{id}", produces="application/json")
    public byte[] load(@RequestHeader(value="Authorization",defaultValue="") String header, @PathVariable long id) {
        authenticate(header);
        return jdbc.query("SELECT content FROM journal_backups WHERE id=?", (rs, row) -> rs.getBytes(1), id)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
