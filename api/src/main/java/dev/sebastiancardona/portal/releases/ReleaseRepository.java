package dev.sebastiancardona.portal.releases;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ReleaseRepository extends JpaRepository<Release, Long> {

    List<Release> findByRepo(String repo);

    // explicit "nulls last": Postgres puts NULLs first on DESC, and a release
    // without published_at must not pin itself to the top of the feed
    @Query("select r from Release r where r.app = :app order by r.publishedAt desc nulls last")
    List<Release> timelineForApp(String app);

    @Query("select r from Release r order by r.publishedAt desc nulls last")
    List<Release> recent(Limit limit);
}
