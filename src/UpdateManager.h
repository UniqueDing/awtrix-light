#ifndef UpdateManager_h
#define UpdateManager_h

#include <Arduino.h>

class UpdateManager_
{
private:
    UpdateManager_() = default;

    struct Candidate
    {
        String version;
        String asset;
        String sha256;
        uint32_t size = 0;
        bool valid = false;
    };

    Candidate candidate;
    String availableVersion;
    String lastError;
    bool lastCheckOk = false;

public:
    static UpdateManager_ &getInstance();
    void setup();
    bool checkUpdate(bool withScreen);
    void updateFirmware();
    bool hasCandidate() const;
    String statusJson() const;
};

extern UpdateManager_ &UpdateManager;
#endif
