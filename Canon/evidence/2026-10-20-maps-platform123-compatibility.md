# Maps — zgodność kanału odczytu z platform1.23

Status: LOCAL_SOURCE_COMPATIBILITY_VERIFIED_NOT_RELEASED. Zadanie SRM-E1-MAPS-PLATFORM-123-COMPATIBILITY-20261020, Development.

Do dopuszczonych peerów dodano1.23.0; poprzedni odbiór1.22 i jego łańcuch zachowano w całości. Te same trzy pliki kanału odczytu mają te same fingerprinty. Nie zmieniono kontraktu komunikacji, funkcji Maps, Google API, usług, ról ani wdrożeń. Nowy publiczny transport nie został przyjęty jako funkcja Maps. Rzeczywiste testy:12/12 PASS, zero pominięć, w tym lokalny serwer HTTP; build PASS. Dowody: maps-tests-public123.log i maps-build-public123.log. Nie wykonano wydania Maps.
