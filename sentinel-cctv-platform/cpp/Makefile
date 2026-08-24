CXX = g++
CXXFLAGS = -std=c++17 -Wall -O2 -Iinclude
TARGET = sentinel_anpr_engine
SRCS = src/anpr_engine.cpp src/main.cpp
OBJS = src/anpr_engine.o src/main.o

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS)

src/anpr_engine.o: src/anpr_engine.cpp include/anpr_engine.hpp
	$(CXX) $(CXXFLAGS) -c src/anpr_engine.cpp -o src/anpr_engine.o

src/main.o: src/main.cpp include/anpr_engine.hpp
	$(CXX) $(CXXFLAGS) -c src/main.cpp -o src/main.o

clean:
	rm -f src/*.o $(TARGET)

.PHONY: all clean
